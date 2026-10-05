-- Add Sustainable Development Goal classification to missions while preserving Mission -> Campaign -> Referral -> Donation -> Impact.

create table if not exists public.mission_sdgs (
 mission_id uuid not null references public.missions(id) on delete cascade,
 sdg_number smallint not null check (sdg_number between 1 and 17),
 created_at timestamptz not null default now(),
 primary key (mission_id, sdg_number)
);

create index if not exists mission_sdgs_sdg_number_idx on public.mission_sdgs(sdg_number,mission_id);

alter table public.mission_sdgs enable row level security;
revoke all on public.mission_sdgs from anon,authenticated;
grant select on public.mission_sdgs to authenticated;

drop policy if exists "Read mission SDGs" on public.mission_sdgs;
create policy "Read mission SDGs" on public.mission_sdgs
 for select to authenticated
 using (true);

create or replace function public.create_mission_v3(
 p_city uuid,
 p_manual_place text,
 p_manual_country text,
 p_community uuid,
 p_actor uuid,
 p_title text,
 p_overview text,
 p_location text,
 p_goal text,
 p_sdgs smallint[],
 p_roles text default null,
 p_start date default null,
 p_end date default null,
 p_budget numeric default null,
 p_funding numeric default null,
 p_currency char(3) default 'EUR'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
 if not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;

 if p_sdgs is null or cardinality(p_sdgs)=0
   or exists(select 1 from unnest(p_sdgs) s where s not between 1 and 17)
 then raise exception 'Select at least one valid SDG'; end if;

 if p_city is not null then
   if p_manual_place is not null or p_manual_country is not null then raise exception 'Choose one mission location method'; end if;
   if not exists(select 1 from public.places where id=p_city and source_key is not null) then raise exception 'City unavailable'; end if;
 else
   if nullif(trim(coalesce(p_manual_place,'')),'') is null or nullif(trim(coalesce(p_manual_country,'')),'') is null then raise exception 'Manual place and country are required'; end if;
   if p_community is not null then raise exception 'Manual mission locations cannot link a mesh community'; end if;
 end if;

 if char_length(coalesce(p_roles,''))>2000 then raise exception 'Roles too long'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 3 and 180
   or char_length(trim(coalesce(p_overview,''))) not between 10 and 5000
   or char_length(trim(coalesce(p_location,''))) not between 2 and 240
   or char_length(trim(coalesce(p_goal,''))) not between 3 and 2000
   or char_length(trim(coalesce(p_manual_place,''))) > 160
 then raise exception 'Invalid mission details'; end if;

 insert into public.missions(
   city_id,manual_place,manual_country,community_id,created_by_actor_id,title,overview,location_text,goal,roles_summary,
   starts_on,ends_on,budget_amount,funding_goal_amount,currency_code
 )
 values(
   p_city,
   nullif(trim(coalesce(p_manual_place,'')),''),
   nullif(trim(coalesce(p_manual_country,'')),''),
   p_community,p_actor,trim(p_title),trim(p_overview),trim(p_location),trim(p_goal),
   nullif(trim(coalesce(p_roles,'')),''),
   p_start,p_end,p_budget,p_funding,p_currency
 )
 returning id into v_id;

 insert into public.mission_sdgs(mission_id,sdg_number)
 select v_id,s
 from (select distinct unnest(p_sdgs)::smallint as s) x
 order by s;

 return v_id;
end
$$;

revoke all on function public.create_mission_v3(uuid,text,text,uuid,uuid,text,text,text,text,smallint[],text,date,date,numeric,numeric,char) from public,anon;
grant execute on function public.create_mission_v3(uuid,text,text,uuid,uuid,text,text,text,text,smallint[],text,date,date,numeric,numeric,char) to authenticated;

create or replace function public.set_mission_sdgs(p_mission uuid,p_sdgs smallint[])
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
 if not exists(
   select 1 from public.missions m
   where m.id=p_mission and public.can_act_as(m.created_by_actor_id)
 ) then raise exception 'Not permitted'; end if;

 if p_sdgs is null or cardinality(p_sdgs)=0
   or exists(select 1 from unnest(p_sdgs) s where s not between 1 and 17)
 then raise exception 'Select at least one valid SDG'; end if;

 delete from public.mission_sdgs where mission_id=p_mission;
 insert into public.mission_sdgs(mission_id,sdg_number)
 select p_mission,s
 from (select distinct unnest(p_sdgs)::smallint as s) x
 order by s;
end
$$;

revoke all on function public.set_mission_sdgs(uuid,smallint[]) from public,anon;
grant execute on function public.set_mission_sdgs(uuid,smallint[]) to authenticated;
