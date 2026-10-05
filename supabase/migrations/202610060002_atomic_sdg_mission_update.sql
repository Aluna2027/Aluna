-- Update SDG Mission details and SDG assignments atomically.

create or replace function public.update_mission_v2(
 p_mission uuid,
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
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
 if not exists(
   select 1 from public.missions m
   where m.id=p_mission and public.can_act_as(m.created_by_actor_id)
 ) then
  raise exception 'Not permitted';
 end if;

 if p_sdgs is null or cardinality(p_sdgs)=0
   or exists(select 1 from unnest(p_sdgs) s where s not between 1 and 17)
 then
  raise exception 'Select at least one valid SDG';
 end if;

 if char_length(coalesce(p_roles,''))>2000
   or char_length(trim(coalesce(p_title,''))) not between 3 and 180
   or char_length(trim(coalesce(p_overview,''))) not between 10 and 5000
   or char_length(trim(coalesce(p_location,''))) not between 2 and 240
   or char_length(trim(coalesce(p_goal,''))) not between 3 and 2000
   or (p_start is not null and p_end is not null and p_end<p_start)
   or p_currency not in ('EUR','USD','GBP')
 then
  raise exception 'Invalid mission details';
 end if;

 update public.missions
 set title=trim(p_title),
     overview=trim(p_overview),
     location_text=trim(p_location),
     goal=trim(p_goal),
     roles_summary=nullif(trim(coalesce(p_roles,'')),''),
     starts_on=p_start,
     ends_on=p_end,
     budget_amount=p_budget,
     funding_goal_amount=p_funding,
     currency_code=p_currency,
     updated_at=now()
 where id=p_mission;

 delete from public.mission_sdgs where mission_id=p_mission;
 insert into public.mission_sdgs(mission_id,sdg_number)
 select p_mission,s
 from (select distinct unnest(p_sdgs)::smallint as s) x
 order by s;
end
$$;

revoke all on function public.update_mission_v2(uuid,text,text,text,text,smallint[],text,date,date,numeric,numeric,char) from public,anon;
grant execute on function public.update_mission_v2(uuid,text,text,text,text,smallint[],text,date,date,numeric,numeric,char) to authenticated;
