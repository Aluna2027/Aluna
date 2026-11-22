begin;
create table public.message_blocks(
 blocker_actor_id uuid not null references public.actors(id) on delete cascade,
 blocked_actor_id uuid not null references public.actors(id) on delete cascade,
 primary key(blocker_actor_id,blocked_actor_id),check(blocker_actor_id<>blocked_actor_id));
alter table public.message_blocks enable row level security;
revoke all on public.message_blocks from public,anon,authenticated;
grant select on public.message_blocks to authenticated;
create policy "Read controlled blocks" on public.message_blocks for select to authenticated
 using(public.can_act_as(blocker_actor_id));
create table public.conversation_hidden(
 profile_id uuid not null references public.profiles(id) on delete cascade,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 hidden_at timestamptz not null,primary key(profile_id,conversation_id));
alter table public.conversation_hidden enable row level security;
revoke all on public.conversation_hidden from public,anon,authenticated;
grant select on public.conversation_hidden to authenticated;
create policy "Read own hidden conversations" on public.conversation_hidden for select to authenticated using(profile_id=auth.uid());

create function public.conversation_inbox() returns setof public.conversations
language sql stable security invoker set search_path='' as $$
 select c.* from public.conversations c where not exists(
 select 1 from public.conversation_hidden h where h.profile_id=auth.uid() and h.conversation_id=c.id)
 order by c.created_at desc limit 50
$$;
revoke all on function public.conversation_inbox() from public,anon,authenticated;
grant execute on function public.conversation_inbox() to authenticated;

create function public.set_conversation_control(p_conversation uuid,p_actor uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.conversations%rowtype; peer uuid;
begin
 if auth.uid() is null or not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;
 select * into c from public.conversations where id=p_conversation for update;
 if not found or p_actor not in(c.actor_a,c.actor_b) then raise exception 'Not permitted'; end if;
 peer:=case when c.actor_a=p_actor then c.actor_b else c.actor_a end;
 if p_action='block' then insert into public.message_blocks values(p_actor,peer) on conflict do nothing;
 elsif p_action='unblock' then delete from public.message_blocks where blocker_actor_id=p_actor and blocked_actor_id=peer;
 elsif p_action='hide' then insert into public.conversation_hidden values(auth.uid(),c.id,clock_timestamp())
  on conflict(profile_id,conversation_id) do update set hidden_at=excluded.hidden_at;
 else raise exception 'Invalid conversation action'; end if;
end $$;
revoke all on function public.set_conversation_control(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_conversation_control(uuid,uuid,text) to authenticated;

create function public.guard_private_message() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.conversations%rowtype; peer uuid;
begin
 select * into c from public.conversations where id=new.conversation_id for update;
 if auth.uid() is null or not found or not public.can_act_as(new.sender_actor_id)
  or new.sender_actor_id not in(c.actor_a,c.actor_b) then raise exception 'Not permitted'; end if;
 peer:=case when c.actor_a=new.sender_actor_id then c.actor_b else c.actor_a end;
 if exists(select 1 from public.message_blocks where blocker_actor_id=peer and blocked_actor_id=new.sender_actor_id)
 then raise exception 'Messaging unavailable for this conversation'; end if;
 new.created_at:=clock_timestamp();
 -- Only a successfully accepted new message restores hidden inbox entries.
 delete from public.conversation_hidden where conversation_id=c.id;
 return new;
end $$;
revoke all on function public.guard_private_message() from public,anon,authenticated;
create trigger guard_private_message before insert on public.direct_messages for each row execute function public.guard_private_message();
commit;
