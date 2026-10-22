-- Reproducible synthetic-data upgrade assertions on isolated local Supabase only.
\set ON_ERROR_STOP on
do $$
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>52 then
   raise exception 'Expected exactly 52 recorded local migrations';
 end if;
 if (select count(*) from public.organizations where id in
   ('22222222-2222-4222-8222-222222222221','22222222-2222-4222-8222-222222222222')
   and lower(description) like '%pre-upgrade row must survive')<>2 then
   raise exception 'Pre-upgrade organization rows were altered or deleted';
 end if;
 if not exists(select 1 from public.profiles
   where id='11111111-1111-4111-8111-111111111111' and date_of_birth='1990-02-03')
 then raise exception 'Existing profile and date of birth not preserved'; end if;
 if (select count(*) from public.organization_members
   where organization_id='22222222-2222-4222-8222-222222222221'
     and (profile_id='11111111-1111-4111-8111-111111111111' and member_role='admin'
       or profile_id='11111111-1111-4111-8111-111111111112' and member_role='member'))<>2
 then raise exception 'Organization memberships/roles not preserved';end if;
 if not exists(select 1 from public.organization_verified_domains
   where organization_id='22222222-2222-4222-8222-222222222221'
   and domain='seeded.pr33-upgrade.invalid')
 then raise exception 'Verified domain not preserved'; end if;
 if not exists(select 1 from public.organization_claim_requests
   where id='44444444-4444-4444-8444-444444444444' and status='needs_review')
 then raise exception 'Claim not preserved'; end if;
 if not exists(select 1 from public.organization_invitations
   where id='33333333-3333-4333-8333-333333333333'
     and revoked_at is null and redeemed_at is null and expires_at>now())
 then raise exception 'Pending invitation not preserved'; end if;
 if not exists(select 1 from public.organization_access_audit
   where action='pr33_pre_upgrade_fixture' and details->>'source'='synthetic_pre_upgrade')
 then raise exception 'Existing audit history not preserved';end if;
 if not exists(select 1 from information_schema.columns
   where table_schema='public' and table_name='profiles' and column_name='gender')
 then raise exception 'New profile gender column missing';end if;
 if not exists(select 1 from pg_constraint
   where conrelid='public.profiles'::regclass and conname='profiles_gender_allowed')
 then raise exception 'Gender check constraint missing';end if;
 if to_regprocedure('public.complete_member_onboarding_v4(text,text,text,text,text,text,text[],text[],public.aluna_member_role,date,text)') is null
 or to_regprocedure('public.aluna_audited_reject_claim(uuid,uuid)') is null
 or to_regprocedure('public.aluna_audited_invitation_delivery_failure(uuid,uuid,text)') is null
 then raise exception 'PR33 RPC missing'; end if;
 if not exists(select 1 from pg_indexes
   where schemaname='public' and tablename='organization_verified_domains'
   and indexname='organization_verified_domains_unique_domain')
 then raise exception 'Global verified-domain uniqueness missing';end if;
 if has_function_privilege('authenticated',
   'public.aluna_audited_reject_claim(uuid,uuid)'::regprocedure,'EXECUTE')
 or has_function_privilege('anon',
   'public.aluna_audited_invitation_delivery_failure(uuid,uuid,text)'::regprocedure,'EXECUTE')
 then raise exception 'Audit RPC grants exposed to browser roles';end if;
 if not (select relrowsecurity from pg_class where oid='public.aluna_profile_moderation_audit'::regclass)
 then raise exception 'Moderation audit missing RLS';end if;
end $$;
\echo 'PASS: data survived upgrade, permissions and new objects present'

-- Confirm an audited mutation works, inside a transaction we then roll back.
begin;
set local role service_role;
do $$
begin
 if public.aluna_audited_reject_claim(
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111')
 <> '22222222-2222-4222-8222-222222222222'::uuid
 then raise exception 'Unexpected audited rejection result'; end if;
 if not exists(select 1 from public.organization_access_audit
    where action='claim_rejected' and organization_id='22222222-2222-4222-8222-222222222222')
 then raise exception 'Audit row not written atomically';end if;
end $$;
rollback;

-- Force the audit insert to fail (foreign key) and confirm transaction reverts the claim update.
do $$
begin
 begin
  perform public.aluna_audited_reject_claim(
   '44444444-4444-4444-8444-444444444444',
   '99999999-9999-4999-8999-999999999999');
  raise exception 'Invalid audit actor unexpectedly accepted';
 exception when foreign_key_violation then null;
 end;
 if not exists(select 1 from public.organization_claim_requests
   where id='44444444-4444-4444-8444-444444444444' and status='needs_review'
   and decided_at is null and decided_by is null)
 then raise exception 'Audit failure did not revert claim mutation';end if;
end $$;
\echo 'PASS: atomic audited actions, and audit failure rolls back the business change'
