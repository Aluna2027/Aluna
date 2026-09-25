-- Phase 13: complementary graph queries over the existing relational source of truth.
create table public.actor_relationships (
 id uuid primary key default gen_random_uuid(),
 source_actor_id uuid not null references public.actors(id) on delete cascade,
 target_actor_id uuid not null references public.actors(id) on delete cascade,
 relationship_type text not null check(relationship_type in ('partner','collaborator','worked_with','funded','supported')),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 context text check(context is null or char_length(context)<=1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint actor_relationship_no_self check(source_actor_id<>target_actor_id),
 unique(source_actor_id,target_actor_id,relationship_type)
);
create index actor_relationships_target_idx on public.actor_relationships(target_actor_id,status,created_at desc);
alter table public.actor_relationships enable row level security;
create policy "Read accepted actor relationships" on public.actor_relationships for select to authenticated
 using(status='accepted' or public.can_act_as(source_actor_id) or public.can_act_as(target_actor_id));
create policy "Request actor relationship" on public.actor_relationships for insert to authenticated
 with check(public.can_act_as(source_actor_id) and status='pending');
create policy "Respond to actor relationship" on public.actor_relationships for update to authenticated
 using(status='pending' and public.can_act_as(target_actor_id))
 with check(status in ('accepted','declined'));
create policy "Remove controlled actor relationship" on public.actor_relationships for delete to authenticated
 using(public.can_act_as(source_actor_id) or public.can_act_as(target_actor_id));
revoke update on public.actor_relationships from authenticated;
grant update(status,updated_at) on public.actor_relationships to authenticated;

create function public.social_graph_edges(p_actor uuid)
returns table(source_actor_id uuid,relation text,target_actor_id uuid,status text,created_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select f.follower_actor_id,'follow',f.followed_actor_id,'accepted',f.created_at from public.follows f
 where f.follower_actor_id=p_actor or f.followed_actor_id=p_actor
 union all
 select c.actor_a,'connection',c.actor_b,c.status::text,c.created_at from public.connections c
 where c.actor_a=p_actor or c.actor_b=p_actor
 union all
 select pa.id,'member',oa.id,'accepted',om.created_at
 from public.organization_members om join public.actors pa on pa.profile_id=om.profile_id join public.actors oa on oa.organization_id=om.organization_id
 where pa.id=p_actor or oa.id=p_actor
 union all
 select r.source_actor_id,r.relationship_type,r.target_actor_id,r.status,r.created_at from public.actor_relationships r
 where r.source_actor_id=p_actor or r.target_actor_id=p_actor
 order by created_at desc
$$;
revoke all on function public.social_graph_edges(uuid) from public;
grant execute on function public.social_graph_edges(uuid) to authenticated;

create function public.impact_graph_edges_for(p_actor uuid default null,p_mission uuid default null,p_community uuid default null,p_city uuid default null)
returns table(source_type text,source_id uuid,relation text,target_type text,target_id uuid,metadata jsonb,occurred_at timestamptz)
language sql stable security invoker set search_path='' as $$
 with relevant_missions as (
  select distinct m.* from public.missions m left join public.mission_participations mp on mp.mission_id=m.id
  where (p_mission is null or m.id=p_mission) and (p_community is null or m.community_id=p_community) and (p_city is null or m.city_id=p_city)
    and (p_actor is null or m.created_by_actor_id=p_actor or mp.actor_id=p_actor)
 ), relevant_contributions as (
  select c.* from public.contributions c where (p_actor is null or c.actor_id=p_actor)
   and (p_mission is null or c.mission_id=p_mission) and (p_community is null or c.community_id=p_community) and (p_city is null or c.city_id=p_city)
 ), relevant_proofs as (
  select p.* from public.proofs p left join relevant_contributions c on c.id=p.contribution_id
  where (p_actor is null or p.actor_id=p_actor) and (p_mission is null or p.mission_id=p_mission)
   and (p_city is null or p.city_id=p_city) and (p_community is null or c.community_id=p_community)
 )
 select case when a.profile_id is not null then 'user' else 'organization' end,coalesce(a.profile_id,a.organization_id),'represented_by','actor',a.id,
   jsonb_build_object('profile_id',a.profile_id,'organization_id',a.organization_id),a.created_at
 from public.actors a where p_actor is null or a.id=p_actor
 union all select 'actor',m.created_by_actor_id,'created','mission',m.id,'{}'::jsonb,m.created_at from relevant_missions m
 union all select 'actor',mp.actor_id,'participated','mission',mp.mission_id,jsonb_build_object('kind',mp.participation_kind),mp.joined_at from public.mission_participations mp join relevant_missions m on m.id=mp.mission_id
 union all select 'mission',m.id,'located_in','community',m.community_id,'{}'::jsonb,m.created_at from relevant_missions m where m.community_id is not null
 union all select 'mission',m.id,'located_in','city',m.city_id,'{}'::jsonb,m.created_at from relevant_missions m
 union all select 'actor',c.actor_id,'contributed_to','contribution',c.id,jsonb_build_object('type',c.contribution_type,'quantity',c.quantity,'unit',c.quantity_unit),c.created_at from relevant_contributions c
 union all select 'contribution',c.id,'contributed_to','mission',c.mission_id,'{}'::jsonb,c.created_at from relevant_contributions c where c.mission_id is not null
 union all select 'contribution',c.id,'located_in','community',c.community_id,'{}'::jsonb,c.created_at from relevant_contributions c where c.community_id is not null
 union all select 'contribution',c.id,'located_in','city',c.city_id,'{}'::jsonb,c.created_at from relevant_contributions c where c.city_id is not null
 union all select 'contribution',p.contribution_id,'supported_by','proof',p.id,jsonb_build_object('evidence_type',p.evidence_type),p.created_at from relevant_proofs p where p.contribution_id is not null
 union all select 'proof',p.id,'verified_by','verification',e.id,jsonb_build_object('level',e.new_level,'method',e.method,'origin',e.evidence_origin),e.recorded_at from relevant_proofs p join public.proof_verification_events e on e.proof_id=p.id
 union all select 'proof',p.id,'measured_by','impact_metric',null,jsonb_build_object('result',p.result_text,'verification_level',p.verification_level),p.created_at from relevant_proofs p
 order by 7 desc
$$;
revoke all on function public.impact_graph_edges_for(uuid,uuid,uuid,uuid) from public;
grant execute on function public.impact_graph_edges_for(uuid,uuid,uuid,uuid) to authenticated;
