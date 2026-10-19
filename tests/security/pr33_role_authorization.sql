-- Isolated backend integration tests for the ACTUAL PR #33 role RPC.
-- Must run only against the disposable PostgreSQL CI service.
\set ON_ERROR_STOP on
\echo 'PR33: reject unauthenticated RPC'
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  begin
    perform public.aluna_admin_set_organization_role(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '22222222-2222-4222-8222-222222222222', 'member');
    raise exception 'FAIL: anonymous role executed management RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo 'PR33: reject ordinary organization admin using protected RPC'
set role authenticated;
select set_config('request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222', false);
do $$
begin
  begin
    perform public.aluna_admin_set_organization_role(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111', 'member');
    raise exception 'FAIL: ordinary organization admin changed a role through the RPC';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'PR33: deny direct update despite existing SQL grants'
do $$
declare affected integer;
begin
  update public.organization_members
  set member_role = 'member'
  where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and profile_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: ordinary account directly updated % membership rows', affected;
  end if;
end $$;

\echo 'PR33: deny direct insertion'
do $$
begin
  begin
    insert into public.organization_members(organization_id,profile_id,member_role)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
           '33333333-3333-4333-8333-333333333333', 'admin');
    raise exception 'FAIL: ordinary account inserted admin membership';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'PR33: deny direct deletion'
do $$
declare affected integer;
begin
  delete from public.organization_members
  where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and profile_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: ordinary account deleted % membership rows', affected;
  end if;
end $$;
reset role;

\echo 'PR33: reject removal of the final administrator'
set role authenticated;
select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111', false);
do $$
begin
  begin
    perform public.aluna_admin_set_organization_role(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111', 'member');
    raise exception 'FAIL: final administrator was removed';
  exception when check_violation then null;
  end;
end $$;

\echo 'PR33: reject invalid role values'
do $$
begin
  begin
    perform public.aluna_admin_set_organization_role(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '22222222-2222-4222-8222-222222222222', 'super_admin');
    raise exception 'FAIL: invalid role value was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

\echo 'PR33: allow audited changes only by Super Admin'
do $$
begin
  if public.aluna_admin_set_organization_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222', 'member') <> 'updated'
  then raise exception 'FAIL: authorized demotion did not complete'; end if;
  if public.aluna_admin_set_organization_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222', 'admin') <> 'updated'
  then raise exception 'FAIL: authorized promotion did not complete'; end if;
end $$;
reset role;

\echo 'PR33: verify final database state and exact audit rows'
do $$
begin
  if (select count(*) from public.organization_members
      where member_role = 'admin') <> 3
  then raise exception 'FAIL: membership states were changed unexpectedly'; end if;
  if (select count(*) from public.organization_access_audit) <> 2
  then raise exception 'FAIL: role changes did not produce exactly two audit events'; end if;
  if (select count(*) from public.organization_access_audit
      where actor_id = '11111111-1111-4111-8111-111111111111'
        and action = 'organization_role_changed'
        and details->>'previous_role' = 'admin'
        and details->>'new_role' = 'member') <> 1
  then raise exception 'FAIL: missing authorized demotion audit'; end if;
  if (select count(*) from public.organization_access_audit
      where actor_id = '11111111-1111-4111-8111-111111111111'
        and action = 'organization_role_changed'
        and details->>'previous_role' = 'member'
        and details->>'new_role' = 'admin') <> 1
  then raise exception 'FAIL: missing authorized promotion audit'; end if;
end $$;
\echo 'PASS: isolated PR33 role security tests'
