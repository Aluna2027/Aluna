-- PR #43: L4 Aluna assessment must not imply a physical site visit.
-- Keep legacy ground_visit valid for genuinely documented on-site inspections.
-- All existing authorization and separation-of-reviewer checks are preserved.
-- Historical proof events are NOT rewritten by this migration.
alter table public.proof_verification_events
  drop constraint if exists proof_verification_events_method_check;
alter table public.proof_verification_events
  add constraint proof_verification_events_method_check
  check (method in ('self_report','peer_attestation','partner_review','ground_visit','aluna_review'));

create or replace function public.pr43_review_result(p_result uuid,p_actor uuid,p_value numeric,p_impact_result text default null)
returns smallint language plpgsql security definer set search_path='' as $$
declare
 r public.pr43_contribution_results%rowtype;
 contributor public.contributions%rowtype;
 reviewer_org uuid;
 contributor_org uuid;
 l2_org uuid;
 l2_actor uuid;
 reviewer_level smallint;
 v_next smallint;
 v_role text;
 v_method text;
 v_proof uuid;
begin
 if auth.uid() is null or p_actor is null or not public.can_act_as(p_actor) then
  raise exception 'Reviewer not authorized';
 end if;
 select * into r from public.pr43_contribution_results where id=p_result for update;
 if not found then raise exception 'Result not found'; end if;
 select * into contributor from public.contributions where id=r.contribution_id;
 if not found then raise exception 'Linked contribution not found'; end if;
 if r.verification_level=4 then raise exception 'Already at L4. Revoke to correct an error'; end if;
 if p_value is null or p_value<0 or p_value>1000000000
    or (p_value<>trunc(p_value) and r.metric_key in
      ('people_connected','nodes_installed','local_owners','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed','contribution_verified')) then
  raise exception 'Invalid confirmed quantity';
 end if;
 if char_length(coalesce(p_impact_result,''))>3000
   or char_length(trim(coalesce(p_impact_result,''))) between 1 and 9 then
  raise exception 'Impact result must be empty or contain 10 to 3000 characters';
 end if;
 if exists(select 1 from public.pr43_contribution_reviews x
            where x.result_id=p_result and x.revoked_at is null and x.reviewer_profile_id=auth.uid()) then
  raise exception 'Same person cannot perform multiple verification levels';
 end if;
 select organization_id into reviewer_org from public.actors where id=p_actor;
 select organization_id into contributor_org from public.actors where id=contributor.actor_id;
 select max_level into reviewer_level from public.proof_verifier_grants where profile_id=auth.uid();
 v_next:=r.verification_level+1;

 if v_next=1 then
  if p_actor<>contributor.actor_id then raise exception 'L1 requires the original contributing actor'; end if;
  v_role:='owner';v_method:='self_report';
 elsif v_next=2 then
  if reviewer_org is null or public.can_act_as(contributor.actor_id) then
   raise exception 'L2 requires a separate organization and contributor';
  end if;
  if not (
   exists(select 1 from public.mission_participations mp
          where mp.mission_id=contributor.mission_id and mp.actor_id=p_actor)
   or exists(select 1 from public.missions m
          where m.id=contributor.mission_id and m.created_by_actor_id=p_actor)
   or exists(select 1 from public.mesh_community_members cm
          where cm.community_id=contributor.community_id and cm.actor_id=p_actor)
  ) then raise exception 'L2 organization must be involved in the selected project'; end if;
  v_role:='organization';v_method:='peer_attestation';
 elsif v_next=3 then
  if not exists (
    select 1 from public.pr43_l3_assignments assignment
    where assignment.result_id=p_result and assignment.reviewer_profile_id=auth.uid()
      and assignment.reviewer_actor_id=p_actor and assignment.revoked_at is null
  ) then raise exception 'L3 requires explicit Aluna assignment for this result'; end if;
  if reviewer_org is null or coalesce(reviewer_level,0)<3 or public.can_act_as(contributor.actor_id) then
   raise exception 'L3 requires an authorized independent organization';
  end if;
  select x.reviewer_actor_id into l2_actor from public.pr43_contribution_reviews x
   where x.result_id=p_result and x.role='organization' and x.revoked_at is null;
  select organization_id into l2_org from public.actors where id=l2_actor;
  if l2_org is null or reviewer_org=l2_org or reviewer_org=contributor_org then
   raise exception 'L3 cannot be the contributor or L2 organization';
  end if;
  if exists(select 1 from public.organization_members a
      join public.organization_members b on b.profile_id=a.profile_id
      where a.organization_id=reviewer_org and b.organization_id=l2_org)
    or (contributor_org is not null and exists(
      select 1 from public.organization_members a
      join public.organization_members b on b.profile_id=a.profile_id
      where a.organization_id=reviewer_org and b.organization_id=contributor_org)) then
    raise exception 'L3 shares administration with an affiliated organization';
  end if;
  if exists(select 1 from public.mission_participations mp
        where mp.mission_id=contributor.mission_id and mp.actor_id=p_actor)
    or exists(select 1 from public.mesh_community_members cm
        where cm.community_id=contributor.community_id and cm.actor_id=p_actor)
    or exists(select 1 from public.missions m
        where m.id=contributor.mission_id and m.created_by_actor_id=p_actor) then
    raise exception 'L3 reviewer is involved in the project';
  end if;
  v_role:='independent';v_method:='partner_review';
 elsif v_next=4 then
  if not public.is_aluna_admin() or public.can_act_as(contributor.actor_id) then
   raise exception 'L4 requires a separate authorized Aluna administrator';
  end if;
  v_role:='aluna';v_method:='aluna_review';
 else
  raise exception 'Verification sequence invalid';
 end if;

 insert into public.pr43_contribution_reviews
   (result_id,reviewer_actor_id,reviewer_profile_id,role,confirmed_quantity,impact_result)
 values(p_result,p_actor,auth.uid(),v_role,p_value,nullif(trim(coalesce(p_impact_result,'')),''));

 if r.proof_id is null then
  insert into public.proofs
   (actor_id,mission_id,city_id,contribution_id,evidence_type,evidence_description,result_text,occurred_on,verification_level)
  values(contributor.actor_id,contributor.mission_id,contributor.city_id,contributor.id,'partner_confirmation',
   'Project contribution review with linked records and supporting attachments.',
   coalesce(nullif(trim(coalesce(p_impact_result,'')),''),contributor.title||' — reported project contribution'),
   current_date,1)
  returning id into v_proof;
  update public.pr43_contribution_results set proof_id=v_proof where id=p_result;
 else
  v_proof:=r.proof_id;
  update public.proofs set verification_level=v_next where id=v_proof;
 end if;
 insert into public.proof_verification_events
  (proof_id,previous_level,new_level,verifier_actor_id,verifier_profile_id,method,reason)
 values(v_proof,case when v_next=1 then null else v_next-1 end,v_next,p_actor,auth.uid(),
  v_method,'PR43 role-separated verification with recorded actor, measured quantity and evidence.');

 update public.pr43_contribution_results
 set verification_level=v_next,
     verified_quantity=case when v_next>=3 then p_value else null end
 where id=p_result;
 return v_next;
end $$;
