-- Disposable local Supabase ONLY. Synthetic identifiers and reserved .invalid emails.
-- Applied after all migrations through PR32 and before the PR33 migration series.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if to_regclass('public.aluna_profile_moderation_audit') is not null
     or to_regclass('public.organization_domain_challenges') is not null
     or to_regprocedure('public.complete_member_onboarding_v4(text,text,text,text,text,text,text[],text[],public.aluna_member_role,date,text)') is not null
  then
    raise exception 'This is not a pre-PR33 baseline; refuse to seed';
  end if;
end $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
 ('00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated','authenticated','admin@pr33-upgrade.invalid','', now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111112',
  'authenticated','authenticated','member@pr33-upgrade.invalid','', now(),now(),now());

-- Auth Admin and password-login HTTP checks also require provider identities.
-- These rows belong exclusively to disposable reserved .invalid test accounts;
-- no live account, email or production auth data is changed.
insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at)
select id::text,id,
       jsonb_build_object('sub',id::text,'email',email,
                          'email_verified',true,'phone_verified',false),
       'email',now(),now()
from auth.users
where id in ('11111111-1111-4111-8111-111111111111',
             '11111111-1111-4111-8111-111111111112');

update auth.users
set raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data='{}'::jsonb
where id in ('11111111-1111-4111-8111-111111111111',
             '11111111-1111-4111-8111-111111111112');

update public.profiles set date_of_birth='1990-02-03'
where id='11111111-1111-4111-8111-111111111111';

insert into public.organizations (id,name,organization_type,country,description)
values
 ('22222222-2222-4222-8222-222222222221','PR33 Synthetic University','university','Netherlands','Pre-upgrade row must survive'),
 ('22222222-2222-4222-8222-222222222222','PR33 Synthetic NGO','ngo','Netherlands','Second pre-upgrade row must survive');

insert into public.organization_members (organization_id,profile_id,member_role)
values ('22222222-2222-4222-8222-222222222221','11111111-1111-4111-8111-111111111111','admin'),
       ('22222222-2222-4222-8222-222222222221','11111111-1111-4111-8111-111111111112','member');

insert into public.organization_verified_domains (organization_id,domain,approved_by)
values ('22222222-2222-4222-8222-222222222221','seeded.pr33-upgrade.invalid','11111111-1111-4111-8111-111111111111');

insert into public.organization_claim_requests (id,organization_id,requester_id,requester_email,domain,status)
values ('44444444-4444-4444-8444-444444444444',
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111112',
 'member@pr33-upgrade.invalid','claim.pr33-upgrade.invalid','needs_review');

insert into public.organization_invitations (id,organization_id,recipient_email,token_hash,invited_by,expires_at)
values ('33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222221',
 'invitee@pr33-upgrade.invalid',repeat('a',64),
 '11111111-1111-4111-8111-111111111111',now()+interval '10 days');

insert into public.organization_access_audit (organization_id,actor_id,subject_id,action,details)
values ('22222222-2222-4222-8222-222222222221',
 '11111111-1111-4111-8111-111111111111',
 '11111111-1111-4111-8111-111111111112',
 'pr33_pre_upgrade_fixture','{"source":"synthetic_pre_upgrade"}'::jsonb);

do $$
begin
 if (select count(*) from public.organizations where name like 'PR33 Synthetic %')<>2
 or (select count(*) from public.organization_members where organization_id='22222222-2222-4222-8222-222222222221')<>2
 then raise exception 'Fixture not established'; end if;
end $$;
commit;
\echo 'PASS: synthetic organizations, profiles, memberships, domain, claim, invitation, and audit seeded'
