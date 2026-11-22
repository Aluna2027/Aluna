-- Members-only audiences are enforced by RLS and the storage policy through
-- can_view_post. This migration is prepared locally and must be approved before
-- applying to any Supabase project.
begin;

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public','followers','members'));
alter table public.posts drop constraint if exists community_posts_public;
alter table public.posts drop constraint if exists mission_posts_public;
alter table public.posts add constraint contextual_post_audience_check
  check ((community_id is null and mission_id is null) or visibility in ('public','members'));

alter table public.scheduled_posts drop constraint if exists scheduled_posts_visibility_check;
alter table public.scheduled_posts add constraint scheduled_posts_visibility_check
  check (visibility in ('public','followers','members'));
alter table public.scheduled_posts add constraint scheduled_context_audience_check
  check ((community_id is null and mission_id is null) or visibility in ('public','members'));

create or replace function public.can_view_post(p_post uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
declare p public.posts%rowtype;
begin
 select * into p from public.posts where id=p_post;
 if not found then return false; end if;
 -- Repost audience/context is immutable and validated on creation. Do not
 -- recurse or change effective visibility of historical public/follower rows.
 if p.visibility='public' then return true; end if;
 if p.visibility<>'members' and public.can_act_as(p.actor_id) then return true; end if;
 if p.visibility='followers' then
   return exists(select 1 from public.follows f where f.followed_actor_id=p.actor_id and public.can_act_as(f.follower_actor_id));
 end if;
 if p.visibility='members' and p.community_id is not null then
   return exists(select 1 from public.mesh_community_members m where m.community_id=p.community_id and public.can_act_as(m.actor_id));
 end if;
 if p.visibility='members' and p.mission_id is not null then
   return exists(select 1 from public.actors a where public.can_act_as(a.id) and public.is_mission_participant(p.mission_id,a.id));
 end if;
 return false;
end
$fn$;
revoke all on function public.can_view_post(uuid) from public, anon;
grant execute on function public.can_view_post(uuid) to authenticated;

drop policy if exists "Read visible posts" on public.posts;
create policy "Read visible posts" on public.posts for select to authenticated using (public.can_view_post(id));

create or replace function public.pr47_guard_post_audience() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare target public.posts%rowtype;
begin
 if tg_op='UPDATE' and (new.visibility is distinct from old.visibility
   or new.community_id is distinct from old.community_id or new.mission_id is distinct from old.mission_id
   or new.repost_of_id is distinct from old.repost_of_id) then
   raise exception 'Published post audience and context cannot be changed';
 end if;
 if new.visibility='members' then
   if (new.community_id is null)=(new.mission_id is null) then raise exception 'Members-only posts require one community or mission'; end if;
   if new.community_id is not null and not public.is_mesh_member(new.community_id,new.actor_id) then raise exception 'Community membership required'; end if;
   if new.mission_id is not null and not public.is_mission_participant(new.mission_id,new.actor_id) then raise exception 'Mission participation required'; end if;
 end if;
 if tg_op='INSERT' and new.repost_of_id is not null then
   if new.repost_of_id=new.id then raise exception 'Cyclic repost'; end if;
   if exists (with recursive chain as (
     select id,repost_of_id,array[id] as visited,false as cycle from public.posts where id=new.repost_of_id
     union all select p.id,p.repost_of_id,c.visited||p.id,p.id=any(c.visited)
     from public.posts p join chain c on p.id=c.repost_of_id where not c.cycle
   ) select 1 from chain where cycle or id=new.id) then raise exception 'Cyclic repost'; end if;
   select * into target from public.posts where id=new.repost_of_id;
   if not found or target.visibility='followers' then raise exception 'This post cannot be reshared'; end if;
   if target.visibility='members' and (new.visibility<>'members' or new.community_id is distinct from target.community_id or new.mission_id is distinct from target.mission_id) then
     raise exception 'A members-only repost must keep its original audience';
   end if;
 end if;
 return new;
end
$fn$;
drop trigger if exists pr47_guard_post_audience on public.posts;
revoke all on function public.pr47_guard_post_audience() from public,anon,authenticated;
create trigger pr47_guard_post_audience before insert or update on public.posts
for each row execute function public.pr47_guard_post_audience();

-- Scoped feeds return only rows authorized by the same RLS gate.
create or replace function public.mesh_community_feed_page(p_community uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns table(id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,author_name text,author_kind text,reaction_count bigint,comment_count bigint)
language sql stable security invoker set search_path = '' as $fn$
 select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,coalesce(pr.display_name,o.name,'Member'),case when a.profile_id is not null then 'user' else o.organization_type::text end,
 (select count(*) from public.reactions r where r.post_id=p.id),(select count(*) from public.comments c where c.post_id=p.id)
 from public.posts p join public.actors a on a.id=p.actor_id left join public.public_profiles pr on pr.id=a.profile_id left join public.organizations o on o.id=a.organization_id
 where p.community_id=p_community and (p_before is null or (p_before_id is null and p.created_at<p_before) or (p.created_at,p.id)<(p_before,p_before_id))
 order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50)
$fn$;
create or replace function public.mission_feed_page(p_mission uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns table(id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,author_name text,author_kind text,reaction_count bigint,comment_count bigint)
language sql stable security invoker set search_path = '' as $fn$
 select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,coalesce(pr.display_name,o.name,'Member'),case when a.profile_id is not null then 'user' else o.organization_type::text end,
 (select count(*) from public.reactions r where r.post_id=p.id),(select count(*) from public.comments c where c.post_id=p.id)
 from public.posts p join public.actors a on a.id=p.actor_id left join public.public_profiles pr on pr.id=a.profile_id left join public.organizations o on o.id=a.organization_id
 where p.mission_id=p_mission and (p_before is null or (p_before_id is null and p.created_at<p_before) or (p.created_at,p.id)<(p_before,p_before_id))
 order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50)
$fn$;

create or replace function public.feed_page(p_following boolean default false,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns table(id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,author_name text,author_kind text,reaction_count bigint,comment_count bigint,media_path text,media_type text)
language sql stable security invoker set search_path = '' as $fn$
 select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,coalesce(pr.display_name,o.name,'Member'),case when a.profile_id is not null then 'user' else o.organization_type::text end,
 (select count(*) from public.reactions r where r.post_id=p.id),(select count(*) from public.comments c where c.post_id=p.id),p.media_path,p.media_type
 from public.posts p join public.actors a on a.id=p.actor_id left join public.public_profiles pr on pr.id=a.profile_id left join public.organizations o on o.id=a.organization_id
 where (p_before is null or (p_before_id is null and p.created_at<p_before) or (p.created_at,p.id)<(p_before,p_before_id))
 and ((not p_following and p.visibility='public') or (p_following and p.visibility in ('public','followers') and (public.can_act_as(p.actor_id) or exists(select 1 from public.follows f where f.followed_actor_id=p.actor_id and public.can_act_as(f.follower_actor_id)))))
 order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50)
$fn$;
revoke all on function public.feed_page(boolean,timestamptz,uuid,integer) from public;
grant execute on function public.feed_page(boolean,timestamptz,uuid,integer) to authenticated;
revoke all on function public.mesh_community_feed_page(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.mesh_community_feed_page(uuid,timestamptz,uuid,integer) to authenticated;
revoke all on function public.mission_feed_page(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.mission_feed_page(uuid,timestamptz,uuid,integer) to authenticated;

-- Notifications are hidden when their linked post is outside the recipient's view.
drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications for select to authenticated using (
 public.can_act_as(recipient_actor_id) and
 case when kind in ('mention','comment','reaction') then public.can_view_post(target_id)
      when kind='comment_mention' then exists(select 1 from public.comments c where c.id=target_id and public.can_view_post(c.post_id))
      else true end);

-- Post mention notifications follow membership for every human controlling a
-- mentioned organization actor. The existing trigger remains authoritative for
-- public and follower posts; this adds the contextual member audience case.
create or replace function public.pr47_comment_recipient_can_view(p_post uuid,p_recipient uuid) returns boolean
language sql stable security definer set search_path = '' as $fn$
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
    and ((p.visibility<>'members' and controlled.id=p.actor_id)
      or (p.visibility='followers' and exists(select 1 from public.follows f where f.follower_actor_id=controlled.id and f.followed_actor_id=p.actor_id))
      or (p.visibility='members' and p.community_id is not null and public.is_mesh_member(p.community_id,controlled.id))
      or (p.visibility='members' and p.mission_id is not null and public.is_mission_participant(p.mission_id,controlled.id)))
   ))) as allowed from principals who
 ) select exists(select 1 from access) and not exists(select 1 from access where not allowed)
$fn$;
create or replace function public.pr47_sync_member_post_mentions() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare item jsonb; recipient uuid; newly_mentioned boolean;
begin
 if new.visibility<>'members' then return new; end if;
 for item in select value from jsonb_array_elements(new.mention_refs) loop
  recipient:=(item->>'actorId')::uuid;
  if tg_op='INSERT' then newly_mentioned:=true;
  else select not exists(select 1 from jsonb_array_elements(old.mention_refs) prior where prior->>'actorId'=item->>'actorId') into newly_mentioned;
  end if;
  if recipient<>new.actor_id and newly_mentioned and public.pr47_comment_recipient_can_view(new.id,recipient) then
   insert into public.notifications(recipient_actor_id,sender_actor_id,kind,target_id) values(recipient,new.actor_id,'mention',new.id)
   on conflict (recipient_actor_id,target_id) where kind='mention' and target_id is not null do nothing;
  end if;
 end loop;
 return new;
end
$fn$;
revoke all on function public.pr47_sync_member_post_mentions() from public,anon,authenticated;
create trigger pr47_sync_member_post_mentions after insert or update of body,mention_refs on public.posts
for each row execute function public.pr47_sync_member_post_mentions();

-- Scheduled context and audience are checked both on insertion and by RPC edits.
create or replace function public.edit_scheduled_post(p_id uuid,p_body text,p_scheduled_for timestamptz,p_visibility text,p_mention_refs jsonb)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare r public.scheduled_posts%rowtype;
begin
 select * into r from public.scheduled_posts where id=p_id for update;
 if not found or not public.can_act_as(r.actor_id) then raise exception 'Not permitted'; end if;
 if r.status<>'pending' then raise exception 'Post is no longer editable'; end if;
 if p_body is null or char_length(trim(p_body))>5000 or (char_length(trim(p_body))=0 and (r.media_path is null or r.media_type not in ('image','video'))) then raise exception 'Invalid post'; end if;
 if r.community_id is not null or r.mission_id is not null then
   if p_visibility not in ('public','members') then raise exception 'Invalid audience'; end if;
   if r.visibility='members' and p_visibility<>'members' then raise exception 'Members-only audience cannot be expanded'; end if;
   if p_visibility='members' and ((r.community_id is not null and not public.is_mesh_member(r.community_id,r.actor_id)) or (r.mission_id is not null and not public.is_mission_participant(r.mission_id,r.actor_id))) then raise exception 'Membership required'; end if;
 else
   if p_visibility not in ('public','followers') then raise exception 'Invalid audience'; end if;
 end if;
 update public.scheduled_posts set body=trim(p_body),mention_refs=coalesce(p_mention_refs,'[]'::jsonb),scheduled_for=p_scheduled_for,visibility=p_visibility,retry_after=null,attempt_count=0,last_error=null,updated_at=now() where id=p_id;
 return true;
end
$fn$;
create or replace function public.edit_scheduled_post(p_id uuid,p_body text,p_scheduled_for timestamptz,p_visibility text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare r public.scheduled_posts%rowtype;
begin
 select * into r from public.scheduled_posts where id=p_id for update;
 if not found or not public.can_act_as(r.actor_id) then raise exception 'Not permitted'; end if;
 return public.edit_scheduled_post(p_id,p_body,p_scheduled_for,p_visibility,case when trim(p_body)=r.body then r.mention_refs else '[]'::jsonb end);
end
$fn$;
revoke all on function public.edit_scheduled_post(uuid,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.edit_scheduled_post(uuid,text,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.edit_scheduled_post(uuid,text,timestamptz,text) to authenticated;
grant execute on function public.edit_scheduled_post(uuid,text,timestamptz,text,jsonb) to authenticated;

-- Every existing notification generator passes this recipient gate.
create function public.pr47_guard_member_notification() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare parent_id uuid; audience text;
begin
 if new.kind in ('mention','comment','reaction') then parent_id:=new.target_id;
 elsif new.kind='comment_mention' then select post_id into parent_id from public.comments where id=new.target_id;
 else return new; end if;
 select visibility into audience from public.posts where id=parent_id;
 if audience='members' and (public.can_act_as(new.recipient_actor_id)
   or not public.pr47_comment_recipient_can_view(parent_id,new.recipient_actor_id)) then return null; end if;
 return new;
end
$fn$;
revoke all on function public.pr47_guard_member_notification() from public,anon,authenticated;
create trigger pr47_guard_member_notification before insert on public.notifications
for each row execute function public.pr47_guard_member_notification();

-- Replace the permissive owner exception; adding another policy would OR it.
drop policy "Read own scheduled post media" on storage.objects;
create policy "Read own scheduled post media" on storage.objects for select to authenticated using (
 bucket_id='post-media' and exists (
  select 1 from public.scheduled_posts s where s.id::text=split_part(name,'/',2)
   and s.media_path=name and s.status in ('draft','pending','failed')
   and public.can_act_as(s.actor_id)
   and (s.visibility<>'members' or (
     (s.community_id is not null and public.is_mesh_member(s.community_id,s.actor_id))
     or (s.mission_id is not null and public.is_mission_participant(s.mission_id,s.actor_id))))
   and not exists(select 1 from public.posts p where p.id=s.id)
 ));

-- A restrictive policy ANDs with every permissive Storage SELECT policy.
-- SECURITY DEFINER sees member references hidden from the caller by post RLS.
create function public.pr47_storage_client_readable(p_path text) returns boolean
language sql stable security definer set search_path='' as $fn$
 select not exists(select 1 from public.posts p where p.visibility='members'
   and (p.media_path=p_path or p.id::text=split_part(p_path,'/',2)))
 and not exists(select 1 from public.scheduled_posts s where s.visibility='members'
   and (s.media_path=p_path or s.id::text=split_part(p_path,'/',2)))
$fn$;
revoke all on function public.pr47_storage_client_readable(text) from public,anon,authenticated;
grant execute on function public.pr47_storage_client_readable(text) to anon,authenticated;
create policy "PR47 member media server boundary" on storage.objects as restrictive
 for select to anon,authenticated using (
 bucket_id<>'post-media' or public.pr47_storage_client_readable(name));

-- Fail closed if this deployment's bucket configuration could bypass SELECT RLS.
do $fn$ begin
 if not exists(select 1 from storage.buckets where id='post-media' and not public)
 then raise exception 'post-media must already be a private bucket'; end if;
end $fn$;

commit;
