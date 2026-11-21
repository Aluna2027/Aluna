begin;
-- Dedicated comment references; post/scheduled-post trigger functions are NOT reused.
alter table public.comments add column mention_refs jsonb not null default '[]'::jsonb
 check(jsonb_typeof(mention_refs)='array' and jsonb_array_length(mention_refs)<=30);
create table public.comment_mentions(
 comment_id uuid not null references public.comments(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete cascade,
 start_offset integer not null check(start_offset>=0),
 label text not null check(char_length(label) between 1 and 150),
 primary key(comment_id,start_offset)
);
alter table public.comment_mentions enable row level security;
revoke all on public.comment_mentions from public,anon,authenticated;
grant select on public.comment_mentions to authenticated;
create policy "Read mentions on visible comments" on public.comment_mentions for select to authenticated
 using(exists(select 1 from public.comments c where c.id=comment_id and public.can_view_post(c.post_id)));
-- A distinct target prevents post/comment UUID ambiguity and leaves post dedup unchanged.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in
 ('follow','connection','comment','reaction','message','membership','mention','comment_mention'));
create unique index notifications_one_comment_mention on public.notifications(recipient_actor_id,target_id)
 where kind='comment_mention' and target_id is not null;

create function public.pr47_validate_comment_mentions() returns trigger
language plpgsql security invoker set search_path='' as $$
declare item jsonb; pos integer; last_end integer:=0; label_text text; target uuid; valid boolean;
begin
 if jsonb_typeof(new.mention_refs) is distinct from 'array' or jsonb_array_length(new.mention_refs)>30 then raise exception 'Invalid comment mentions';end if;
 for item in select value from jsonb_array_elements(new.mention_refs) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'actorId') is distinct from 'string'
   or jsonb_typeof(item->'label') is distinct from 'string' or jsonb_typeof(item->'start') is distinct from 'number'
   or (item->>'start')!~'^[0-9]{1,7}$' then raise exception 'Invalid comment mention';end if;
  target:=(item->>'actorId')::uuid;pos:=(item->>'start')::integer;label_text:=item->>'label';
  if pos<last_end or char_length(label_text) not between 1 and 150
   or substring(new.body from pos+1 for char_length(label_text)+1) is distinct from '@'||label_text
   or (pos>0 and substring(new.body from pos for 1)~'^[[:alnum:]_]$') then raise exception 'Comment mention text mismatch';end if;
  select exists(select 1 from public.actors a left join public.public_profiles p on p.id=a.profile_id
    left join public.organizations o on o.id=a.organization_id
    where a.id=target and ((a.profile_id is not null and p.display_name=label_text)
      or (a.organization_id is not null and o.removed_at is null and o.name=label_text))) into valid;
  if not valid then raise exception 'Comment mention target unavailable';end if;
  last_end:=pos+char_length(label_text)+1;
 end loop;
 return new;
end $$;
revoke all on function public.pr47_validate_comment_mentions() from public,anon,authenticated;
create trigger pr47_validate_comment_mentions before insert or update of body,mention_refs on public.comments
 for each row execute function public.pr47_validate_comment_mentions();

-- Evaluate parent visibility for EVERY human who can act as the mentioned actor.
-- This avoids exposing a followers-only post through a multi-admin organization inbox.
create function public.pr47_comment_recipient_can_view(p_post uuid,p_recipient uuid) returns boolean
language sql stable security definer set search_path='' as $$
 with recipient as (
  select a.* from public.actors a left join public.organizations o on o.id=a.organization_id
   where a.id=p_recipient and (a.profile_id is not null or o.removed_at is null)
 ), principals as (
  select profile_id from recipient where profile_id is not null
  union select m.profile_id from recipient r join public.organization_members m on m.organization_id=r.organization_id where m.member_role='admin'
 ), access as (
  select who.profile_id,exists(
   select 1 from public.posts p where p.id=p_post and (p.visibility='public' or exists(
    select 1 from public.actors controlled left join public.organizations o on o.id=controlled.organization_id
    where (controlled.profile_id=who.profile_id or (controlled.organization_id is not null and o.removed_at is null and exists(
     select 1 from public.organization_members m where m.organization_id=controlled.organization_id and m.profile_id=who.profile_id and m.member_role='admin')))
    and (controlled.id=p.actor_id or exists(select 1 from public.follows f where f.follower_actor_id=controlled.id and f.followed_actor_id=p.actor_id))
   ))) as allowed from principals who
 ) select exists(select 1 from access) and not exists(select 1 from access where not allowed)
$$;
revoke all on function public.pr47_comment_recipient_can_view(uuid,uuid) from public,anon,authenticated;
create function public.pr47_sync_comment_mentions() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb;recipient uuid;
begin
 if jsonb_array_length(new.mention_refs)=0 then return new;end if;
 if auth.uid() is null or not public.can_act_as(new.actor_id) or not public.can_view_post(new.post_id) then raise exception 'Comment mention write not authorized';end if;
 for item in select value from jsonb_array_elements(new.mention_refs) loop
  recipient:=(item->>'actorId')::uuid;
  insert into public.comment_mentions(comment_id,actor_id,start_offset,label) values(new.id,recipient,(item->>'start')::integer,item->>'label');
  if recipient<>new.actor_id and not public.can_act_as(recipient) and public.pr47_comment_recipient_can_view(new.post_id,recipient) then
   insert into public.notifications(recipient_actor_id,sender_actor_id,kind,target_id) values(recipient,new.actor_id,'comment_mention',new.id)
    on conflict(recipient_actor_id,target_id) where kind='comment_mention' and target_id is not null do nothing;
  end if;
 end loop;
 return new;
end $$;
revoke all on function public.pr47_sync_comment_mentions() from public,anon,authenticated;
create trigger pr47_sync_comment_mentions after insert on public.comments for each row execute function public.pr47_sync_comment_mentions();
create function public.pr47_remove_comment_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin delete from public.notifications where kind='comment_mention' and target_id=old.id;return old;end $$;
revoke all on function public.pr47_remove_comment_notifications() from public,anon,authenticated;
create trigger pr47_remove_comment_notifications after delete on public.comments for each row execute function public.pr47_remove_comment_notifications();
commit;
