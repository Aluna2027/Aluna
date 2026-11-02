-- PR #43: Resolve measurements made via a linked SDG Mission and its Wi-Fi Mesh Community
-- to the same canonical network before choosing the latest verified stock snapshot.
-- Also make the associated Community and City Impact scopes recognize linked missions.
-- No contribution or verification rows are modified.

create or replace function public.pr43_impact_rollup(
 p_actor uuid default null, p_mission uuid default null, p_community uuid default null, p_city uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with scoped as (
  select r.id, r.metric_key, r.verified_quantity, r.measured_on, r.created_at,
         c.id as contribution_id,c.actor_id,c.mission_id,
         coalesce(c.community_id,m.community_id) as community_id,
         coalesce(c.city_id,m.city_id,mc.city_id) as city_id,
         coalesce(c.community_id,m.community_id,c.mission_id) as snapshot_project_id,
         a.organization_id
  from public.pr43_contribution_results r
  join public.contributions c on c.id=r.contribution_id
  join public.actors a on a.id=c.actor_id
  left join public.missions m on m.id=c.mission_id
  left join public.mesh_communities mc on mc.id=coalesce(c.community_id,m.community_id)
  where auth.uid() is not null
    and r.verification_level>=case when r.metric_key='money_invested' then 4 else 3 end and r.verified_quantity is not null
    and (p_actor is null or c.actor_id=p_actor)
    and (p_mission is null or c.mission_id=p_mission)
    and (p_community is null or coalesce(c.community_id,m.community_id)=p_community)
    and (p_city is null or coalesce(c.city_id,m.city_id,mc.city_id)=p_city)
 ),
 snapshots as (
  select distinct on (metric_key,snapshot_project_id)
    metric_key,verified_quantity
  from scoped
  where metric_key in ('people_connected','nodes_installed','local_owners')
  order by metric_key,snapshot_project_id,
           measured_on desc,created_at desc,id desc
 ),
 ordinary as (
  select coalesce(sum(verified_quantity) filter(where metric_key='money_invested'),0) as invested,
    coalesce(sum(verified_quantity) filter(where metric_key='volunteer_hours'),0) as hours,
    coalesce(sum(verified_quantity) filter(where metric_key='skills_contributed'),0) as skills,
    (count(distinct mission_id) filter(where metric_key='mission_completed')
     + count(distinct community_id) filter(where metric_key='wifi_completed')) as completed,
    count(id) filter(where metric_key='sdg_metrics') as sdgs,
    coalesce(sum(verified_quantity) filter(where metric_key='community_data'),0) as data_count,
    count(distinct organization_id) filter(where organization_id is not null) as orgs,
    count(id) as verified
  from scoped
 )
 select jsonb_build_object(
  'peopleConnected',coalesce((select sum(verified_quantity) from snapshots where metric_key='people_connected'),0),
  'nodesInstalled',coalesce((select sum(verified_quantity) from snapshots where metric_key='nodes_installed'),0),
  'localOwners',coalesce((select sum(verified_quantity) from snapshots where metric_key='local_owners'),0),
  'missionsCompleted',ordinary.completed,
  'moneyInvested',ordinary.invested,
  'volunteerHours',ordinary.hours,
  'skillsContributed',ordinary.skills,
  'organizationsInvolved',ordinary.orgs,
  'sdgMetrics',ordinary.sdgs,
  'communityData',ordinary.data_count,
  'verifiedResults',ordinary.verified)
 from ordinary
$$;
revoke all on function public.pr43_impact_rollup(uuid,uuid,uuid,uuid) from public;
grant execute on function public.pr43_impact_rollup(uuid,uuid,uuid,uuid) to authenticated;
