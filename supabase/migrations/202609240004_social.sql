-- Phase 4. A single actor owns social content; exactly one user or organization backs it.
create table public.actors (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid unique references public.profiles(id) on delete cascade,
 organization_id uuid unique references public.organizations(id) on delete cascade,
 created_at timestamptz not null default now(),
 constraint actor_owner check ((profile_id is null) <> (organization_id is null))
);
create index actors_profile_idx on public.actors(profile_id) where profile_id is not null;
create index actors_organization_idx on public.actors(organization_id) where organization_id is not null;
insert into public.actors(profile_id) select id from public.profiles on conflict do nothing;
insert into public.actors(organization_id) select id from public.organizations on conflict do nothing;
create function public.create_actor_for_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.actors(profile_id) values(new.id); return new; end $$;
create function public.create_actor_for_organization() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.actors(organization_id) values(new.id); return new; end $$;
create trigger profile_actor_created after insert on public.profiles for each row execute function public.create_actor_for_profile();
create trigger organization_actor_created after insert on public.organizations for each row execute function public.create_actor_for_organization();

-- SECURITY DEFINER helpers avoid policy recursion. They expose only a boolean for the current user.
create function public.can_act_as(p_actor uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.actors a where a.id=p_actor and
   (a.profile_id=auth.uid() or exists(select 1 from public.organization_members m where m.organization_id=a.organization_id and m.profile_id=auth.uid() and m.member_role='admin')))
$$;
revoke all on function public.can_act_as(uuid) from public;
grant execute on function public.can_act_as(uuid) to authenticated;

create table public.follows (
 follower_actor_id uuid not null references public.actors(id) on delete cascade,
 followed_actor_id uuid not null references public.actors(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_actor_id,followed_actor_id),
 constraint no_self_follow check (follower_actor_id<>followed_actor_id)
);
create index follows_followed_idx on public.follows(followed_actor_id,created_at desc);
create type public.connection_status as enum('pending','accepted','declined');
create table public.connections (
 actor_a uuid not null references public.actors(id) on delete cascade,
 actor_b uuid not null references public.actors(id) on delete cascade,
 requested_by uuid not null references public.actors(id) on delete cascade,
 status public.connection_status not null default 'pending',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(actor_a,actor_b),
 constraint connection_order check(actor_a<actor_b),
 constraint connection_requester check(requested_by=actor_a or requested_by=actor_b)
);
create index connections_b_idx on public.connections(actor_b,status);

create table public.posts (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.actors(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 5000),
 visibility text not null default 'public' check(visibility in ('public','followers')),
 repost_of_id uuid references public.posts(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index posts_global_idx on public.posts(created_at desc,id desc) where visibility='public';
create index posts_actor_idx on public.posts(actor_id,created_at desc);
create index posts_repost_idx on public.posts(repost_of_id) where repost_of_id is not null;
create table public.comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments(post_id,created_at,id);
create table public.reactions (
 post_id uuid not null references public.posts(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,actor_id)
);

create function public.can_view_post(p_post uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.posts p where p.id=p_post and
   (p.visibility='public' or public.can_act_as(p.actor_id) or exists(
     select 1 from public.follows f where f.followed_actor_id=p.actor_id and public.can_act_as(f.follower_actor_id))))
$$;
revoke all on function public.can_view_post(uuid) from public;
grant execute on function public.can_view_post(uuid) to authenticated;

create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 actor_a uuid not null references public.actors(id) on delete cascade,
 actor_b uuid not null references public.actors(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(actor_a,actor_b),
 constraint conversation_order check(actor_a<actor_b)
);
create index conversations_b_idx on public.conversations(actor_b,created_at desc);
create table public.direct_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_actor_id uuid not null references public.actors(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index messages_thread_idx on public.direct_messages(conversation_id,created_at desc,id desc);
create function public.can_read_conversation(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.conversations c where c.id=p_id and (public.can_act_as(c.actor_a) or public.can_act_as(c.actor_b)))
$$;
revoke all on function public.can_read_conversation(uuid) from public;
grant execute on function public.can_read_conversation(uuid) to authenticated;
create function public.open_conversation(p_sender uuid,p_recipient uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_a uuid; v_b uuid;
begin
 if p_sender=p_recipient or not public.can_act_as(p_sender) then raise exception 'Not permitted'; end if;
 if not exists(select 1 from public.actors where id=p_recipient) then raise exception 'Recipient unavailable'; end if;
 v_a:=least(p_sender,p_recipient);v_b:=greatest(p_sender,p_recipient);
 insert into public.conversations(actor_a,actor_b) values(v_a,v_b) on conflict(actor_a,actor_b) do nothing;
 select id into v_id from public.conversations where actor_a=v_a and actor_b=v_b;
 return v_id;
end $$;
revoke all on function public.open_conversation(uuid,uuid) from public;
grant execute on function public.open_conversation(uuid,uuid) to authenticated;

create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_actor_id uuid not null references public.actors(id) on delete cascade,
 sender_actor_id uuid references public.actors(id) on delete set null,
 kind text not null check(kind in ('follow','connection','comment','reaction','message')),
 target_id uuid,
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications(recipient_actor_id,is_read,created_at desc);

alter table public.actors enable row level security;
alter table public.follows enable row level security;
alter table public.connections enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.notifications enable row level security;
create policy "Read actors" on public.actors for select to authenticated using(true);
create policy "Read follows" on public.follows for select to authenticated using(true);
create policy "Follow as owned actor" on public.follows for insert to authenticated with check(public.can_act_as(follower_actor_id));
create policy "Unfollow as owned actor" on public.follows for delete to authenticated using(public.can_act_as(follower_actor_id));
create policy "Read own connections" on public.connections for select to authenticated using(public.can_act_as(actor_a) or public.can_act_as(actor_b));
create policy "Request connection" on public.connections for insert to authenticated with check(public.can_act_as(requested_by) and status='pending');
create policy "Respond to connection" on public.connections for update to authenticated using(status='pending' and (public.can_act_as(actor_a) or public.can_act_as(actor_b)) and not public.can_act_as(requested_by)) with check(status in ('accepted','declined'));
revoke update on public.connections from authenticated;
grant update(status,updated_at) on public.connections to authenticated;
create policy "Read visible posts" on public.posts for select to authenticated using(visibility='public' or public.can_act_as(actor_id) or exists(select 1 from public.follows f where f.followed_actor_id=actor_id and public.can_act_as(f.follower_actor_id)));
create policy "Publish as owned actor" on public.posts for insert to authenticated with check(public.can_act_as(actor_id) and (repost_of_id is null or public.can_view_post(repost_of_id)));
create policy "Edit own posts" on public.posts for update to authenticated using(public.can_act_as(actor_id)) with check(public.can_act_as(actor_id));
create policy "Delete own posts" on public.posts for delete to authenticated using(public.can_act_as(actor_id));
revoke update on public.posts from authenticated;
grant update(body,visibility,updated_at) on public.posts to authenticated;
create policy "Read visible comments" on public.comments for select to authenticated using(public.can_view_post(post_id));
create policy "Comment as owned actor" on public.comments for insert to authenticated with check(public.can_act_as(actor_id) and public.can_view_post(post_id));
create policy "Delete own comments" on public.comments for delete to authenticated using(public.can_act_as(actor_id));
create policy "Read visible reactions" on public.reactions for select to authenticated using(public.can_view_post(post_id));
create policy "React as owned actor" on public.reactions for insert to authenticated with check(public.can_act_as(actor_id) and public.can_view_post(post_id));
create policy "Undo own reaction" on public.reactions for delete to authenticated using(public.can_act_as(actor_id));
create policy "Read own conversations" on public.conversations for select to authenticated using(public.can_act_as(actor_a) or public.can_act_as(actor_b));
create policy "Read own messages" on public.direct_messages for select to authenticated using(public.can_read_conversation(conversation_id));
create policy "Send as participant" on public.direct_messages for insert to authenticated with check(public.can_act_as(sender_actor_id) and exists(select 1 from public.conversations c where c.id=conversation_id and (c.actor_a=sender_actor_id or c.actor_b=sender_actor_id)));
create policy "Read own notifications" on public.notifications for select to authenticated using(public.can_act_as(recipient_actor_id));
create policy "Mark own notifications" on public.notifications for update to authenticated using(public.can_act_as(recipient_actor_id)) with check(public.can_act_as(recipient_actor_id));
revoke update on public.notifications from authenticated;
grant update(is_read) on public.notifications to authenticated;

-- Notifications are generated by trusted triggers; clients cannot forge them.
create function public.notify_social_event() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_target uuid; v_kind text; v_sender uuid; v_id uuid;
begin
 if tg_table_name='follows' then v_target:=new.followed_actor_id;v_sender:=new.follower_actor_id;v_kind:='follow';
 elsif tg_table_name='connections' then
   if tg_op='UPDATE' then v_target:=new.requested_by;v_sender:=case when new.actor_a=v_target then new.actor_b else new.actor_a end;
   else v_sender:=new.requested_by;v_target:=case when new.actor_a=v_sender then new.actor_b else new.actor_a end; end if;
   v_kind:='connection';
 elsif tg_table_name='comments' then select actor_id into v_target from public.posts where id=new.post_id;v_sender:=new.actor_id;v_kind:='comment';v_id:=new.post_id;
 elsif tg_table_name='reactions' then select actor_id into v_target from public.posts where id=new.post_id;v_sender:=new.actor_id;v_kind:='reaction';v_id:=new.post_id;
 elsif tg_table_name='direct_messages' then select case when actor_a=new.sender_actor_id then actor_b else actor_a end into v_target from public.conversations where id=new.conversation_id;v_sender:=new.sender_actor_id;v_kind:='message';v_id:=new.conversation_id;
 end if;
 if v_target is not null and v_target<>v_sender then insert into public.notifications(recipient_actor_id,sender_actor_id,kind,target_id) values(v_target,v_sender,v_kind,v_id);end if;
 return new;
end $$;
create trigger notify_follow after insert on public.follows for each row execute function public.notify_social_event();
create trigger notify_connection after insert on public.connections for each row execute function public.notify_social_event();
create trigger notify_connection_accepted after update of status on public.connections for each row when (old.status='pending' and new.status='accepted') execute function public.notify_social_event();
create trigger notify_comment after insert on public.comments for each row execute function public.notify_social_event();
create trigger notify_reaction after insert on public.reactions for each row execute function public.notify_social_event();
create trigger notify_message after insert on public.direct_messages for each row execute function public.notify_social_event();

-- One bounded query per feed page; stable keyset pagination and aggregate counts.
create function public.feed_page(p_following boolean default false,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns table(id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,author_name text,author_kind text,reaction_count bigint,comment_count bigint)
language sql stable security invoker set search_path = '' as $$
 select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,
   coalesce(pr.display_name,o.name,'Member'),case when a.profile_id is not null then 'user' else o.organization_type::text end,
   (select count(*) from public.reactions r where r.post_id=p.id),
   (select count(*) from public.comments c where c.post_id=p.id)
 from public.posts p join public.actors a on a.id=p.actor_id
 left join public.profiles pr on pr.id=a.profile_id
 left join public.organizations o on o.id=a.organization_id
 where (p_before is null or (p_before_id is null and p.created_at<p_before) or (p.created_at,p.id)<(p_before,p_before_id))
   and (not p_following or exists(select 1 from public.follows f where f.followed_actor_id=p.actor_id and public.can_act_as(f.follower_actor_id)))
 order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50)
$$;
revoke all on function public.feed_page(boolean,timestamptz,uuid,integer) from public;
grant execute on function public.feed_page(boolean,timestamptz,uuid,integer) to authenticated;

create extension if not exists pg_trgm;
do $$
declare ext_schema text;
begin
 select n.nspname into ext_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 execute format('create index profiles_name_search_idx on public.profiles using gin (display_name %I.gin_trgm_ops)',ext_schema);
 execute format('create index organizations_name_search_idx on public.organizations using gin (name %I.gin_trgm_ops)',ext_schema);
end $$;
