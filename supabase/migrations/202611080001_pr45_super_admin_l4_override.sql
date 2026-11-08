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
    'aluna_review','aluna_super_admin_override','aluna_accredited_l4_review'
  ));

-- Trained Aluna L4 verifiers are authorized by Super Admins, not self-assigned.
create table public.pr45_l4_verifier_grants (
 profile_id uuid primary key references public.profiles(id) on delete restrict,
 trained_on date not null,
 granted_at timestamptz not null default now(),
 granted_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 rationale text not null check (length(rationale) between 20 and 1000),
 revoked_at timestamptz
);
create table public.pr45_l4_verifier_grant_events (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete restrict,
 changed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 action text not null check (action in ('granted','revoked')),
 reason text not null check (length(reason) between 20 and 1000),
 recorded_at timestamptz not null default now()
);
alter table public.pr45_l4_verifier_grants enable row level security;
alter table public.pr45_l4_verifier_grant_events enable row level security;
revoke all on public.pr45_l4_verifier_grants, public.pr45_l4_verifier_grant_events
  from public, anon, authenticated;

create or replace function public.pr45_can_approve_l4()
returns boolean language sql stable security definer set search_path='' as $
 select auth.uid() is not null
   and (public.is_aluna_super_admin() or exists (
     select 1 from public.pr45_l4_verifier_grants
     where profile_id=auth.uid() and revoked_at is null
   ))
$;
revoke all on function public.pr45_can_approve_l4() from public,anon,authenticated;
grant execute on function public.pr45_can_approve_l4() to authenticated;

create or replace function public.pr45_set_l4_verifier(
 p_profile uuid, p_trained_on date, p_reason text, p_revoke boolean default false
) returns void
language plpgsql security definer set search_path='' as $
declare v_reason text := trim(coalesce(p_reason,''));
begin
 if auth.uid() is null or not public.is_aluna_super_admin() then
   raise exception 'Aluna Super Admin required' using errcode='42501';
 end if;
 if p_profile is null or not exists(select 1 from public.profiles where id=p_profile)
    or length(v_reason) not between 20 and 1000 then
   raise exception 'Valid profile and reason (20-1000 characters) required';
 end if;
 if p_revoke then
   update public.pr45_l4_verifier_grants set revoked_at=now()
     where profile_id=p_profile and revoked_at is null;
   if not found then raise exception 'No active verifier grant to revoke'; end if;
 else
   if p_trained_on is null or p_trained_on>current_date then
     raise exception 'Completed training date required';
   end if;
   insert into public.pr45_l4_verifier_grants
     (profile_id,trained_on,granted_by_profile_id,rationale)
   values (p_profile,p_trained_on,auth.uid(),v_reason)
   on conflict (profile_id) do update
     set trained_on=excluded.trained_on,granted_at=now(),
         granted_by_profile_id=auth.uid(),rationale=excluded.rationale,
         revoked_at=null;
 end if;
 insert into public.pr45_l4_verifier_grant_events
   (profile_id,changed_by_profile_id,action,reason)
 values (p_profile,auth.uid(),case when p_revoke then 'revoked' else 'granted' end,v_reason);
end;
$;
revoke all on function public.pr45_set_l4_verifier(uuid,date,text,boolean) from public,anon,authenticated;
grant execute on function public.pr45_set_l4_verifier(uuid,date,text,boolean) to authenticated;

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
  if auth.uid() is null or not public.pr45_can_approve_l4() then
    raise exception 'Authorized trained Aluna L4 verifier or Super Admin required' using errcode='42501';
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
  -- Delegated verifiers cannot approve contributions they control or
  -- independently re-review something they already attested to.
  if not public.is_aluna_super_admin() and (
    public.can_act_as(v_contribution.actor_id)
    or exists (select 1 from public.pr43_contribution_reviews x
      where x.result_id=p_result and x.reviewer_profile_id=auth.uid()
        and x.revoked_at is null)
  ) then
    raise exception 'Delegated Aluna verifier cannot approve own or previously reviewed result';
  end if;
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
     4, p_actor, auth.uid(),
     case when public.is_aluna_super_admin() then 'aluna_super_admin_override' else 'aluna_accredited_l4_review' end,
     'Internal Aluna L4 approval, NOT independent verification. ' || v_reason);

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
