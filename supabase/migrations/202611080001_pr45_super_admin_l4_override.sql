-- PR #45: explicit Super Admin L4 override for internal Aluna approval.
-- This is not independent L3/L4 verification. Keep verified_quantity NULL so
-- impact rollups and independently verified financial totals do not include it.
-- Only users in aluna_super_admins may execute this RPC, including for their own contributions.
-- Never apply to the shared Demo database before isolated acceptance tests.

alter table public.proof_verification_events
  drop constraint if exists proof_verification_events_method_check;
alter table public.proof_verification_events
  add constraint proof_verification_events_method_check
  check (method in (
    'self_report','peer_attestation','partner_review','ground_visit',
    'aluna_review','aluna_super_admin_override'
  ));

create or replace function public.pr45_super_admin_approve_result(
  p_result uuid, p_actor uuid, p_value numeric, p_reason text
) returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  v_result public.pr43_contribution_results%rowtype;
  v_contribution public.contributions%rowtype;
  v_proof uuid;
  v_reason text := trim(coalesce(p_reason,''));
begin
  if auth.uid() is null or not public.is_aluna_super_admin() then
    raise exception 'Aluna Super Admin required' using errcode='42501';
  end if;
  if p_actor is null or not public.can_act_as(p_actor) then
    raise exception 'Reviewer actor not authorized' using errcode='42501';
  end if;
  if length(v_reason) not between 20 and 1600 then
    raise exception 'Explain your internal L4 approval (20-1600 characters)';
  end if;

  select * into v_result from public.pr43_contribution_results
   where id = p_result for update;
  if not found then raise exception 'Result not found'; end if;
  if v_result.verification_level = 4 then
    raise exception 'Result is already at L4; revoke to correct an error';
  end if;
  select * into v_contribution from public.contributions
   where id = v_result.contribution_id;
  if not found then raise exception 'Linked contribution not found'; end if;
  if p_value is null or p_value < 0 or p_value > 1000000000
    or (p_value <> trunc(p_value) and v_result.metric_key in (
      'people_connected','nodes_installed','local_owners','skills_contributed',
      'sdg_metrics','community_data','mission_completed','wifi_completed',
      'contribution_verified'
    )) then
    raise exception 'Invalid confirmed quantity';
  end if;

  -- A Super Admin may act on a contribution they submitted, or one they
  -- previously self-reviewed at L1. This exception is *only* the internal
  -- Aluna approval path, never an independent certification.
  insert into public.pr43_contribution_reviews
    (result_id, reviewer_actor_id, reviewer_profile_id, role,
     confirmed_quantity, impact_result)
  values (p_result, p_actor, auth.uid(), 'aluna', p_value, v_reason);

  if v_result.proof_id is null then
    insert into public.proofs
      (actor_id, mission_id, city_id, contribution_id,
       evidence_type, evidence_description, result_text,
       occurred_on, verification_level)
    values
      (v_contribution.actor_id, v_contribution.mission_id, v_contribution.city_id,
       v_contribution.id, 'partner_confirmation',
       'Internal Aluna approval; independent L2/L3 verification is not asserted.',
       v_contribution.title || ' - Aluna internal L4 approval',
       current_date, 4)
    returning id into v_proof;
  else
    v_proof := v_result.proof_id;
    update public.proofs set verification_level = 4 where id = v_proof;
  end if;

  insert into public.proof_verification_events
    (proof_id, previous_level, new_level, verifier_actor_id,
     verifier_profile_id, method, reason)
  values
    (v_proof, case when v_result.verification_level = 0 then null
                   else v_result.verification_level end,
     4, p_actor, auth.uid(), 'aluna_super_admin_override',
     'Internal Aluna Super Admin L4 approval, NOT independent verification. ' || v_reason);

  update public.pr43_contribution_results
    set proof_id = v_proof, verification_level = 4,
        verified_quantity = null
    where id = p_result;

  return 4;
end;
$$;

revoke all on function public.pr45_super_admin_approve_result(uuid,uuid,numeric,text)
  from public, anon, authenticated;
grant execute on function public.pr45_super_admin_approve_result(uuid,uuid,numeric,text)
  to authenticated;
