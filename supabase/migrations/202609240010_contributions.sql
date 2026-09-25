-- Phase 10: self-reported contributions. Money entries never modify verified donations.
create table public.contributions (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.actors(id) on delete restrict,
 mission_id uuid references public.missions(id) on delete set null,
 community_id uuid references public.mesh_communities(id) on delete set null,
 city_id uuid references public.places(id) on delete set null,
 contribution_type text not null check (contribution_type in ('time','skills','work','money','equipment','services','materials','research','data')),
 title text not null check (char_length(title) between 3 and 160),
 description text not null check (char_length(description) between 10 and 3000),
 contributed_on date not null default current_date,
 created_at timestamptz not null default now()
);
create index contributions_actor_idx on public.contributions(actor_id,created_at desc);
create index contributions_mission_idx on public.contributions(mission_id,created_at desc) where mission_id is not null;
create index contributions_community_idx on public.contributions(community_id,created_at desc) where community_id is not null;
create index contributions_city_idx on public.contributions(city_id,created_at desc) where city_id is not null;
create function public.check_contribution_place() returns trigger language plpgsql security definer set search_path = '' as $$
declare mission_city uuid; mission_community uuid; community_city uuid;
begin
 if new.mission_id is not null then
  select city_id,community_id into mission_city,mission_community from public.missions where id=new.mission_id;
  if mission_city is null then raise exception 'Mission unavailable'; end if;
 end if;
 if new.community_id is not null then
  select city_id into community_city from public.mesh_communities where id=new.community_id;
  if community_city is null then raise exception 'Community unavailable'; end if;
 end if;
 if mission_city is not null and community_city is not null and mission_city<>community_city then raise exception 'Mission and community must be in the same city'; end if;
 if mission_community is not null and new.community_id is not null and mission_community<>new.community_id then raise exception 'Community must match mission'; end if;
 if new.city_id is not null and ((mission_city is not null and new.city_id<>mission_city) or (community_city is not null and new.city_id<>community_city)) then raise exception 'City must match mission and community'; end if;
 new.city_id:=coalesce(new.city_id,mission_city,community_city);
 if new.city_id is not null and not exists(select 1 from public.places where id=new.city_id and source_key is not null) then raise exception 'City unavailable'; end if;
 return new;
end $$;
create trigger contribution_place_guard before insert on public.contributions for each row execute function public.check_contribution_place();
alter table public.contributions enable row level security;
create policy "Read contributions" on public.contributions for select to authenticated using (true);
create policy "Record as controlled actor" on public.contributions for insert to authenticated with check (public.can_act_as(actor_id));
