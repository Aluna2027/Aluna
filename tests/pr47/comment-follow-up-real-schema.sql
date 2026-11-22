-- Isolated realistic integration overlay using the existing ALUNA production function bodies.
-- Public schema metadata only; NO live data copied or contacted by the workflow.
\set ON_ERROR_STOP on
create table public.organizations(id uuid primary key, removed_at timestamptz, name text);
create table public.organization_members(organization_id uuid,profile_id uuid,member_role text);
create table public.public_profiles(id uuid primary key,display_name text not null);
create table public.follows(follower_actor_id uuid,followed_actor_id uuid);
create table public.mesh_community_members(community_id uuid,actor_id uuid);
alter table public.actors add column profile_id uuid;
alter table public.actors add column organization_id uuid;
alter table public.posts add column community_id uuid;
alter table public.posts add column mission_id uuid;
update public.actors set profile_id=owner_id;
insert into public.public_profiles values
 ('11111111-1111-4111-8111-111111111111','Alice'),
 ('22222222-2222-4222-8222-222222222222','Bob');
update public.posts set community_id='99999999-9999-4999-8999-999999999999'
 where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
insert into public.mesh_community_members values
 ('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
-- This minimal mission predicate is never activated by the fixture (all mission_id NULL).
create function public.is_mission_participant(p_mission uuid,p_actor uuid)
returns boolean language sql stable as $$ select false $$;

-- Actual existing function body inspected read-only via pg_get_functiondef in the target.
create or replace function public.can_act_as(p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.actors a
   left join public.organizations o on o.id=a.organization_id
   where a.id=p_actor
     and (a.profile_id=auth.uid() or
       (a.organization_id is not null and o.removed_at is null and exists(
          select 1 from public.organization_members m where
          m.organization_id=a.organization_id and m.profile_id=auth.uid() and m.member_role='admin'
       )))
 )
$$;
create or replace function public.pr47_can_view_post_fields(
 p_visibility text,p_actor uuid,p_community uuid,p_mission uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_visibility='public'
 or (p_visibility='followers' and (public.can_act_as(p_actor) or exists(
  select 1 from public.follows f where f.followed_actor_id=p_actor
  and public.can_act_as(f.follower_actor_id))))
 or (p_visibility='members' and (
   (p_community is not null and exists(select 1 from public.mesh_community_members m
     where m.community_id=p_community and public.can_act_as(m.actor_id)))
   or (p_mission is not null and exists(select 1 from public.actors a
     where public.can_act_as(a.id) and public.is_mission_participant(p_mission,a.id)))))
$$;
create or replace function public.can_view_post(p_post uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.posts p where p.id=p_post
  and public.pr47_can_view_post_fields(p.visibility,p.actor_id,p.community_id,p.mission_id))
$$;

-- The actual trigger body in the current migrated database (PR #47).
create function public.pr47_validate_comment_mentions() returns trigger
language plpgsql set search_path='' as $$
declare item jsonb;pos integer;last_end integer:=0;label_text text;target uuid;valid boolean;
begin
 if jsonb_typeof(new.mention_refs) is distinct from 'array' or jsonb_array_length(new.mention_refs)>30
 then raise exception 'Invalid comment mentions';end if;
 for item in select value from jsonb_array_elements(new.mention_refs) loop
  if jsonb_typeof(item) is distinct from 'object'
   or jsonb_typeof(item->'actorId') is distinct from 'string'
   or jsonb_typeof(item->'label') is distinct from 'string'
   or jsonb_typeof(item->'start') is distinct from 'number'
   or (item->>'start')!~'^[0-9]{1,7}$' then raise exception 'Invalid comment mention';end if;
  target:=(item->>'actorId')::uuid;pos:=(item->>'start')::integer;
  label_text:=item->>'label';
  if pos<last_end or char_length(label_text) not between 1 and 150
   or substring(new.body from pos+1 for char_length(label_text)+1) is distinct from '@'||label_text
   or (pos>0 and substring(new.body from pos for 1)~'^[[:alnum:]_]$')
  then raise exception 'Comment mention text mismatch';end if;
  select exists(select 1 from public.actors a
    left join public.public_profiles p on p.id=a.profile_id
    left join public.organizations o on o.id=a.organization_id
    where a.id=target and
     ((a.profile_id is not null and p.display_name=label_text)
      or (a.organization_id is not null and o.removed_at is null and o.name=label_text)))
  into valid;
  if not valid then raise exception 'Comment mention target unavailable';end if;
  last_end:=pos+char_length(label_text)+1;
 end loop;
 return new;
end $$;
create trigger pr47_validate_comment_mentions
before insert or update of body,mention_refs on public.comments
for each row execute function public.pr47_validate_comment_mentions();

alter table public.comments enable row level security;
create policy "Read visible comments" on public.comments for select to authenticated
 using(public.can_view_post(post_id));
create policy "Delete own comments" on public.comments for delete to authenticated
 using(public.can_act_as(actor_id));
create policy "Comment as owned actor" on public.comments for insert to authenticated
 with check(public.can_act_as(actor_id) and public.can_view_post(post_id));
grant select,insert,delete on public.comments to authenticated;

-- Verify that the actual trigger did not break legitimate/invalid edits later in test.
