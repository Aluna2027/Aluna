-- Communities are physical Wi-Fi mesh places, anchored to an Aluna city.
create table public.mesh_communities (
 id uuid primary key default gen_random_uuid(),
 city_id uuid not null references public.places(id) on delete restrict,
 name text not null check(char_length(name) between 2 and 160),
 location_text text not null check(char_length(location_text) between 2 and 240),
 description text check(description is null or char_length(description)<=3000),
 population integer check(population is null or population>=0),
 people_connected integer check(people_connected is null or people_connected>=0),
 nodes integer check(nodes is null or nodes>=0),
 local_owners integer check(local_owners is null or local_owners>=0),
 is_verified boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint connected_within_population check(population is null or people_connected is null or people_connected<=population)
);
create index mesh_communities_city_idx on public.mesh_communities(city_id,name);
create type public.mesh_member_role as enum('steward','member');
create table public.mesh_community_members (
 community_id uuid not null references public.mesh_communities(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete cascade,
 member_role public.mesh_member_role not null default 'member',
 joined_at timestamptz not null default now(),
 primary key(community_id,actor_id)
);
create index mesh_members_actor_idx on public.mesh_community_members(actor_id,community_id);

create function public.can_manage_mesh_community(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.mesh_community_members m where m.community_id=p_id and m.member_role='steward' and public.can_act_as(m.actor_id))
$$;
revoke all on function public.can_manage_mesh_community(uuid) from public;
grant execute on function public.can_manage_mesh_community(uuid) to authenticated;
create function public.is_mesh_member(p_community uuid,p_actor uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.mesh_community_members m where m.community_id=p_community and m.actor_id=p_actor)
$$;
revoke all on function public.is_mesh_member(uuid,uuid) from public;
grant execute on function public.is_mesh_member(uuid,uuid) to authenticated;
create function public.create_mesh_community(p_city uuid,p_name text,p_location text,p_actor uuid,p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 160 or char_length(trim(coalesce(p_location,''))) not between 2 and 240 or char_length(coalesce(p_description,''))>3000 then raise exception 'Invalid details'; end if;
 if not exists(select 1 from public.places where id=p_city and source_key is not null) then raise exception 'City unavailable'; end if;
 insert into public.mesh_communities(city_id,name,location_text,description)
 values(p_city,trim(p_name),trim(p_location),nullif(trim(coalesce(p_description,'')),'')) returning id into v_id;
 insert into public.mesh_community_members(community_id,actor_id,member_role) values(v_id,p_actor,'steward');
 return v_id;
end $$;
revoke all on function public.create_mesh_community(uuid,text,text,uuid,text) from public;
grant execute on function public.create_mesh_community(uuid,text,text,uuid,text) to authenticated;

alter table public.mesh_communities enable row level security;
alter table public.mesh_community_members enable row level security;
create policy "Read mesh communities" on public.mesh_communities for select to authenticated using(true);
create policy "Stewards update community" on public.mesh_communities for update to authenticated
using(public.can_manage_mesh_community(id)) with check(public.can_manage_mesh_community(id));
revoke update on public.mesh_communities from authenticated;
grant update(name,location_text,description,population,people_connected,nodes,local_owners,updated_at) on public.mesh_communities to authenticated;
create policy "Read mesh members" on public.mesh_community_members for select to authenticated using(true);
create policy "Join with controlled actor" on public.mesh_community_members for insert to authenticated
with check(member_role='member' and public.can_act_as(actor_id));
create policy "Leave as member" on public.mesh_community_members for delete to authenticated
using(member_role='member' and public.can_act_as(actor_id));
-- The creator remains steward until a later transfer-of-stewardship workflow is added.

alter table public.posts add column community_id uuid references public.mesh_communities(id) on delete set null;
alter table public.posts add constraint community_posts_public check(community_id is null or visibility='public');
create index posts_community_idx on public.posts(community_id,created_at desc,id desc) where community_id is not null;
drop policy "Publish as owned actor" on public.posts;
create policy "Publish as owned actor" on public.posts for insert to authenticated
with check(public.can_act_as(actor_id) and (repost_of_id is null or public.can_view_post(repost_of_id)) and
  (community_id is null or public.is_mesh_member(community_id,actor_id)));
-- community_id is deliberately absent from the posts UPDATE column grants.

create function public.mesh_community_feed_page(p_community uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns table(id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,author_name text,author_kind text,reaction_count bigint,comment_count bigint)
language sql stable security invoker set search_path = '' as $$
 select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,
   coalesce(pr.display_name,o.name,'Member'),case when a.profile_id is not null then 'user' else o.organization_type::text end,
   (select count(*) from public.reactions r where r.post_id=p.id),
   (select count(*) from public.comments c where c.post_id=p.id)
 from public.posts p join public.actors a on a.id=p.actor_id
 left join public.profiles pr on pr.id=a.profile_id
 left join public.organizations o on o.id=a.organization_id
 where p.community_id=p_community and p.visibility='public'
   and (p_before is null or (p_before_id is null and p.created_at<p_before) or (p.created_at,p.id)<(p_before,p_before_id))
 order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50)
$$;
revoke all on function public.mesh_community_feed_page(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.mesh_community_feed_page(uuid,timestamptz,uuid,integer) to authenticated;
