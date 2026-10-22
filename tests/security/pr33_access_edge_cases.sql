-- PR33 isolated access-control regression tests.
-- Only synthetic test identities and .invalid domains; never reach a live app, Auth API, or DNS.
-- Must run after the staged local upgrade. Each successful mutation is rolled back.
\set ON_ERROR_STOP on

-- An ordinary authenticated browser role cannot invoke trusted audit mutations.
begin;
set local role authenticated;
do $$
begin
  begin
    perform public.aluna_audited_revoke_invitation(
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: browser role invoked invitation revocation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.aluna_audited_verify_domain(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: browser role invoked domain verification';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\echo 'PASS: browser role denied trusted access RPCs'

-- Successful revocation, one-time protection and its matching audit entry.
begin;
set local role service_role;
do $$
declare v_org uuid;
begin
  v_org := public.aluna_audited_revoke_invitation(
     '33333333-3333-4333-8333-333333333333',
     '11111111-1111-4111-8111-111111111111');
  if v_org <> '22222222-2222-4222-8222-222222222221'::uuid
     or not exists (select 1 from public.organization_invitations
       where id='33333333-3333-4333-8333-333333333333'
       and revoked_at is not null and redeemed_at is null)
     or (select count(*) from public.organization_access_audit
       where action='invitation_revoked'
       and details->>'invitation_id'='33333333-3333-4333-8333-333333333333')<>1
  then raise exception 'FAIL: invitation revocation and audit are not consistent';end if;
  begin
    perform public.aluna_audited_revoke_invitation(
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: invitation revocation replay succeeded';
  exception when no_data_found then null;
  end;
end $$;
rollback;
\echo 'PASS: invitation revocation, audit and replay denial'

-- Invalid failure reason must not revoke, and actual delivery failure must be audited.
begin;
set local role service_role;
do $$
begin
  begin
    perform public.aluna_audited_invitation_delivery_failure(
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111','not_an_allowed_reason');
    raise exception 'FAIL: unsupported failure reason accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists(select 1 from public.organization_invitations
    where id='33333333-3333-4333-8333-333333333333' and revoked_at is not null)
  then raise exception 'FAIL: invalid reason revoked invitation'; end if;
  perform public.aluna_audited_invitation_delivery_failure(
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111','email_delivery_failed');
  if not exists(select 1 from public.organization_invitations
    where id='33333333-3333-4333-8333-333333333333' and revoked_at is not null)
    or (select count(*) from public.organization_access_audit
    where action='invitation_delivery_failed'
      and details->>'reason'='email_delivery_failed')<>1
  then raise exception 'FAIL: email delivery compensation not atomic'; end if;
  begin
    perform public.aluna_audited_invitation_delivery_failure(
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111','email_delivery_failed');
    raise exception 'FAIL: delivery failure replay accepted';
  exception when no_data_found then null;
  end;
end $$;
rollback;
\echo 'PASS: delivery failure, audit, and replay denial'

-- A failed audit insert must roll back the invitation revocation in the same transaction.
begin;
set local role service_role;
do $$
declare v_before integer;
begin
  select count(*) into v_before from public.organization_access_audit;
  begin
    perform public.aluna_audited_revoke_invitation(
      '33333333-3333-4333-8333-333333333333',
      '99999999-9999-4999-8999-999999999999');
    raise exception 'FAIL: invalid audit actor was accepted';
  exception when foreign_key_violation then null;
  end;
  if not exists(select 1 from public.organization_invitations
       where id='33333333-3333-4333-8333-333333333333'
       and revoked_at is null and redeemed_at is null)
     or (select count(*) from public.organization_access_audit)<>v_before
  then raise exception 'FAIL: audit failure left a partial invitation mutation'; end if;
end $$;
rollback;
\echo 'PASS: audit failure rolls back invitation change'

-- Database-side domain lifecycle. Real TXT/DNS proof is checked in the server action,
-- and is expressly NOT tested by directly invoking these database RPCs.
begin;
set local role service_role;
do $$
declare v_first uuid;v_second uuid;v_expired uuid;
begin
  v_first:=public.aluna_audited_create_domain_challenge(
    '22222222-2222-4222-8222-222222222221','qa.pr33-upgrade.invalid',
    repeat('b',64),'11111111-1111-4111-8111-111111111111',now()+interval '1 hour');
  if not exists(select 1 from public.organization_access_audit
       where action='domain_challenge_created' and details->>'domain'='qa.pr33-upgrade.invalid')
  then raise exception 'FAIL: domain challenge audit missing'; end if;
  if public.aluna_audited_verify_domain(v_first,
       '11111111-1111-4111-8111-111111111111')<>'qa.pr33-upgrade.invalid'
  then raise exception 'FAIL: domain verification failed'; end if;
  if not exists(select 1 from public.organization_verified_domains
       where organization_id='22222222-2222-4222-8222-222222222221'
       and domain='qa.pr33-upgrade.invalid')
  then raise exception 'FAIL: verified domain row absent'; end if;
  begin
    perform public.aluna_audited_verify_domain(v_first,
       '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: domain verification replay succeeded';
  exception when no_data_found then null;
  end;
  v_second:=public.aluna_audited_create_domain_challenge(
    '22222222-2222-4222-8222-222222222222','qa.pr33-upgrade.invalid',
    repeat('c',64),'11111111-1111-4111-8111-111111111111',now()+interval '1 hour');
  begin
    perform public.aluna_audited_verify_domain(v_second,
      '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: same domain verified for second organization';
  exception when unique_violation then null;
  end;
  if not exists(select 1 from public.organization_domain_challenges
      where id=v_second and verified_at is null)
      or (select count(*) from public.organization_verified_domains
        where domain='qa.pr33-upgrade.invalid')<>1
  then raise exception 'FAIL: uniqueness conflict caused partial domain mutation';end if;
  v_expired:=public.aluna_audited_create_domain_challenge(
    '22222222-2222-4222-8222-222222222222','expired.pr33-upgrade.invalid',
    repeat('d',64),'11111111-1111-4111-8111-111111111111',now()-interval '1 hour');
  begin
    perform public.aluna_audited_verify_domain(v_expired,
       '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: expired domain challenge accepted';
  exception when no_data_found then null;
  end;
  if public.aluna_audited_revoke_domain(
    '22222222-2222-4222-8222-222222222221','qa.pr33-upgrade.invalid',
    '11111111-1111-4111-8111-111111111111','Synthetic QA domain cleanup')
    <>'qa.pr33-upgrade.invalid'
  then raise exception 'FAIL: verified domain not revoked';end if;
  if exists(select 1 from public.organization_verified_domains
       where domain='qa.pr33-upgrade.invalid')
     or not exists(select 1 from public.organization_access_audit
       where action='domain_revoked' and details->>'domain'='qa.pr33-upgrade.invalid')
  then raise exception 'FAIL: domain revocation and audit mismatch';end if;
end $$;
rollback;
\echo 'PASS: database domain lifecycle, replay, uniqueness, expiry and audit'

-- Verify redemption contract against existing synthetic Auth users, with no live e-mail
-- or newly created accounts. All mutations are rolled back after assertions.
begin;
set local role service_role;
insert into public.organization_invitations
 (id, organization_id, recipient_email, token_hash, invited_by, expires_at, revoked_at)
values
 ('33333333-3333-4333-8333-333333333334',
  '22222222-2222-4222-8222-222222222221',
  'member@pr33-upgrade.invalid', repeat('e',64),
  '11111111-1111-4111-8111-111111111111', now()+interval '1 day', null),
 ('33333333-3333-4333-8333-333333333335',
  '22222222-2222-4222-8222-222222222221',
  'member@pr33-upgrade.invalid', repeat('f',64),
  '11111111-1111-4111-8111-111111111111', now()-interval '1 minute', null),
 ('33333333-3333-4333-8333-333333333336',
  '22222222-2222-4222-8222-222222222221',
  'member@pr33-upgrade.invalid', repeat('1',64),
  '11111111-1111-4111-8111-111111111111', now()+interval '1 day', now());

do $pr33redemption$
declare v_org uuid;
begin
  -- Neither a forged e-mail nor another user's identity may redeem the link.
  if public.redeem_organization_invitation(
     repeat('e',64),
     '11111111-1111-4111-8111-111111111112','admin@pr33-upgrade.invalid') is not null
   or public.redeem_organization_invitation(
     repeat('e',64),
     '11111111-1111-4111-8111-111111111111','member@pr33-upgrade.invalid') is not null
  then raise exception 'FAIL: invitation redeemed with mismatched verified identity';end if;
  if public.redeem_organization_invitation(
     repeat('f',64),
     '11111111-1111-4111-8111-111111111112','member@pr33-upgrade.invalid') is not null
   or public.redeem_organization_invitation(
     repeat('1',64),
     '11111111-1111-4111-8111-111111111112','member@pr33-upgrade.invalid') is not null
  then raise exception 'FAIL: expired/revoked invitation accepted';end if;
  if not exists(select 1 from public.organization_members
       where organization_id='22222222-2222-4222-8222-222222222221'
         and profile_id='11111111-1111-4111-8111-111111111112'
         and member_role='member')
     or exists(select 1 from public.organization_access_audit
       where action='invitation_accepted')
  then raise exception 'FAIL: rejected invitation mutated roles or audit';end if;

  -- A valid, verified recipient may use the link only once.
  v_org:=public.redeem_organization_invitation(
    repeat('e',64),
    '11111111-1111-4111-8111-111111111112','member@pr33-upgrade.invalid');
  if v_org <> '22222222-2222-4222-8222-222222222221'::uuid
     or not exists(select 1 from public.organization_members
       where organization_id=v_org
         and profile_id='11111111-1111-4111-8111-111111111112' and member_role='admin')
     or not exists(select 1 from public.organization_invitations
       where id='33333333-3333-4333-8333-333333333334'
         and redeemed_by='11111111-1111-4111-8111-111111111112'
         and redeemed_at is not null)
     or (select count(*) from public.organization_access_audit
       where action='invitation_accepted' and actor_id='11111111-1111-4111-8111-111111111112')<>1
  then raise exception 'FAIL: valid invitation was not redeemed atomically';end if;
  if public.redeem_organization_invitation(
    repeat('e',64),
    '11111111-1111-4111-8111-111111111112','member@pr33-upgrade.invalid') is not null
     or (select count(*) from public.organization_access_audit
         where action='invitation_accepted')<>1
  then raise exception 'FAIL: invitation replay accepted or duplicated audit';end if;
end $pr33redemption$;
rollback;
\echo 'PASS: invitation verified-recipient check, expiry, revocation, one-time use and audit'

-- Every test above rolls back. The original pre-upgrade fixture must be unchanged.
do $$
begin
  if not exists(select 1 from public.organization_invitations
      where id='33333333-3333-4333-8333-333333333333'
       and revoked_at is null and redeemed_at is null)
   or not exists(select 1 from public.organization_verified_domains
      where domain='seeded.pr33-upgrade.invalid')
   or (select count(*) from public.organization_access_audit where action<>'pr33_pre_upgrade_fixture')<>0
  then raise exception 'FAIL: isolated E2E tests changed the synthetic baseline';end if;
end $$;
\echo 'PASS: all local data restored after edge-case test transactions'
