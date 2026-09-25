-- Phase 6: missions attach to a city and optionally its physical Wi-Fi mesh community.
create table public.missions (
 id uuid primary key default gen_random_uuid(),
 city_id uuid not null references public.places(id) on delete restrict,
 community_id uuid references public.mesh_communities(id) on delete set null,
 created_by_actor_id uuid not null references public.actors(id) on delete restrict,
 title text not null check(char_length(title) between 3 and 180),
 overview text not null check(char_length(overview) between 10 and 5000),
 location_text text not null check(char_length(location_text) between 2 and 240),
 goal text not null check(char_length(goal) between 3 and 2000),
 roles_summary text check(roles_summary is null or char_length(roles_summary)<=2000),
 starts_on date,
 ends_on date,
 budget_amount numeric(14,2) check(budget_amount is null or budget_amount>=0),
 funding_goal_amount numeric(14,2) check(funding_goal_amount is null or funding_goal_amount>=0),
 currency_code char(3) not null default 'EUR' check(currency_code ~ '^[A-Z]{3}$'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint valid_mission_dates check(starts_on is null or ends_on is null or ends_on>=starts_on)
);
create index missions_city_idx on public.missions(city_id,created_at desc);
create index missions_community_idx on public.missions(community_id,created_at desc) where community_id is not null;
create index missions_actor_idx on public.missions(created_by_actor_id,created_at desc);
create function public.check_mission_place() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.community_id is not null and not exists(select 1 from public.mesh_communities c where c.id=new.community_id and c.city_id=new.city_id) then
   raise exception 'Community must be located in the mission city';
 end if;
 return new;
end $$;
create trigger mission_city_guard before insert or update of city_id,community_id on public.missions for each row execute function public.check_mission_place();
create type public.mission_participation_kind as enum('join_team','volunteer','contribute_skills','contribute_time','provide_expertise','provide_resources');
create table public.mission_participations (
 mission_id uuid not null references public.missions(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete cascade,
 participation_kind public.mission_participation_kind not null,
 joined_at timestamptz not null default now(),
 primary key(mission_id,actor_id,participation_kind)
);
create index mission_participations_actor_idx on public.mission_participations(actor_id,joined_at desc);
create function public.is_mission_participant(p_mission uuid,p_actor uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.missions m where m.id=p_mission and m.created_by_actor_id=p_actor)
 or exists(select 1 from public.mission_participations p where p.mission_id=p_mission and p.actor_id=p_actor)
$$;
revoke all on function public.is_mission_participant(uuid,uuid) from public;
grant execute on function public.is_mission_participant(uuid,uuid) to authenticated;
create function public.create_mission(p_city uuid,p_community uuid,p_actor uuid,p_title text,p_overview text,p_location text,p_goal text,p_roles text default null,p_start date default null,p_end date default null,p_budget numeric default null,p_funding numeric default null,p_currency char(3) default 'EUR')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;
 if not exists(select 1 from public.places where id=p_city and source_key is not null) then raise exception 'City unavailable'; end if;
 if char_length(coalesce(p_roles,''))>2000 then raise exception 'Roles too long'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 3 and 180 or char_length(trim(coalesce(p_overview,''))) not between 10 and 5000 or
    char_length(trim(coalesce(p_location,''))) not between 2 and 240 or char_length(trim(coalesce(p_goal,''))) not between 3 and 2000 then raise exception 'Invalid mission details'; end if;
 insert into public.missions(city_id,community_id,created_by_actor_id,title,overview,location_text,goal,roles_summary,starts_on,ends_on,budget_amount,funding_goal_amount,currency_code)
 values(p_city,p_community,p_actor,trim(p_title),trim(p_overview),trim(p_location),trim(p_goal),nullif(trim(coalesce(p_roles,'')),''),p_start,p_end,p_budget,p_funding,p_currency) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_mission(uuid,uuid,uuid,text,text,text,text,text,date,date,numeric,numeric,char(3)) from public;
grant execute on function public.create_mission(uuid,uuid,uuid,text,text,text,text,text,date,date,numeric,numeric,char(3)) to authenticated;

alter table public.missions enable row level security;
alter table public.mission_participations enable row level security;
create policy "Read missions" on public.missions for select to authenticated using(true);
create policy "Edit own mission" on public.missions for update to authenticated using(public.can_act_as(created_by_actor_id)) with check(public.can_act_as(created_by_actor_id));
revoke update on public.missions from authenticated;
grant update(title,overview,location_text,goal,roles_summary,starts_on,ends_on,budget_amount,funding_goal_amount,currency_code,updated_at) on public.missions to authenticated;
create policy "Read mission participants" on public.mission_participations for select to authenticated using(true);
create policy "Join as controlled actor" on public.mission_participations for insert to authenticated with check(public.can_act_as(actor_id));
create policy "Leave own participation" on public.mission_participations for delete to authenticated using(public.can_act_as(actor_id));

alter table public.posts add column mission_id uuid references public.missions(id) on delete set null;
alter table public.posts add constraint mission_posts_public check(mission_id is null or visibility='public');
alter table public.posts add constraint one_place_for_post check(community_id is null or mission_id is null);
create index posts_mission_idx on public.posts(mission_id,created_at desc,id desc) where mission_id is not null;
drop policy "Publish as owned actor" on public.posts;
create policy "Publish as owned actor" on public.posts for insert to authenticated with check(public.can_act_as(actor_id)
 and (repost_of_id is null or public.can_view_post(repost_of_id))
 and (community_id is null or public.is_mesh_member(community_id,actor_id))
 and (mission_id is null or public.is_mission_participant(mission_id,actor_id)));
-- mission_id cannot be altered by authenticated users (column grant is absent).

create function public.mission_feed_page(p_mission uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns table(id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,author_name text,author_kind text,reaction_count bigint,comment_count bigint)
language sql stable security invoker set search_path = '' as $$
 select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,
   coalesce(pr.display_name,o.name,'Member'),case when a.profile_id is not null then 'user' else o.organization_type::text end,
   (select count(*) from public.reactions r where r.post_id=p.id),
   (select count(*) from public.comments c where c.post_id=p.id)
 from public.posts p join public.actors a on a.id=p.actor_id
 left join public.profiles pr on pr.id=a.profile_id
 left join public.organizations o on o.id=a.organization_id
 where p.mission_id=p_mission and p.visibility='public'
  and (p_before is null or (p_before_id is null and p.created_at<p_before) or (p.created_at,p.id)<(p_before,p_before_id))
 order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50)
$$;
revoke all on function public.mission_feed_page(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.mission_feed_page(uuid,timestamptz,uuid,integer) to authenticated;
