-- PR33 Data API / Storage suspension contract, disposable local Supabase only.
-- Uses only existing synthetic users seeded before the staged PR33 upgrade.
-- This tests the actual DB functions and storage-policy metadata, NOT HTTP,
-- Realtime, JWT validity or live Storage API calls.
\set ON_ERROR_STOP on

do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Aluna active account required for storage'
      and permissive='RESTRICTIVE'
      and cmd='ALL'
      and 'authenticated'=any(roles)
      and qual like '%aluna_is_active_account%'
      and with_check like '%aluna_is_active_account%'
  ) then raise exception 'FAIL: restrictive Storage suspension guard is missing'; end if;
  if not exists(
    select 1 from pg_roles
    where rolname='authenticator'
      and exists(select 1 from unnest(coalesce(rolconfig,array[]::text[])) as config
        where config='pgrst.db_pre_request=public.aluna_require_active_data_api_session')
  ) then raise exception 'FAIL: PostgREST pre-request suspension guard not configured';end if;
end $$;
\echo 'PASS: restrictive Storage policy and Data API hook configuration'

-- A valid preexisting token subject for an active account should be accepted.
begin;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111112"}',true);
select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111112',true);
set local role authenticated;
do $$
begin
  perform public.aluna_require_active_data_api_session();
  if not public.aluna_is_active_account()
  then raise exception 'FAIL: active account rejected by Storage guard';end if;
end $$;
rollback;
\echo 'PASS: active authenticated identity accepted'

-- Changing only the authoritative auth.users ban state must block the SAME
-- (already-issued) token's subject; no login, logout, or token mint is used.
begin;
update auth.users
set banned_until=now()+interval '1 day'
where id='11111111-1111-4111-8111-111111111112';
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111112"}',true);
select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111112',true);
set local role authenticated;
do $$
begin
  begin
    perform public.aluna_require_active_data_api_session();
    raise exception 'FAIL: suspended account allowed through Data API guard';
  exception when insufficient_privilege then null;
  end;
  if public.aluna_is_active_account()
  then raise exception 'FAIL: suspended account allowed by Storage guard';end if;
end $$;
rollback;
\echo 'PASS: suspended existing-subject token blocked by both DB guards'

-- Invalid/missing Auth user must be rejected, even if JWT claims contain an id.
begin;
select set_config('request.jwt.claims',
 '{"role":"authenticated","sub":"99999999-9999-4999-8999-999999999999"}',true);
select set_config('request.jwt.claim.sub',
 '99999999-9999-4999-8999-999999999999',true);
set local role authenticated;
do $$
begin
  begin
    perform public.aluna_require_active_data_api_session();
    raise exception 'FAIL: missing account allowed by Data API guard';
  exception when insufficient_privilege then null;
  end;
  if public.aluna_is_active_account()
  then raise exception 'FAIL: missing account allowed by Storage guard';end if;
end $$;
rollback;
\echo 'PASS: nonexistent identity blocked by both DB guards'

-- Tests did not leave any Auth changes in the disposable database.
do $$
begin
  if exists(select 1 from auth.users
     where id='11111111-1111-4111-8111-111111111112'
     and banned_until is not null)
  then raise exception 'FAIL: synthetic account still suspended after rollback';end if;
end $$;
\echo 'PASS: suspension tests preserved synthetic baseline'
