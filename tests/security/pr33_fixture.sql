-- PR #33 role tests: ephemeral PostgreSQL database ONLY.
-- Synthetic auth roles/claims model Supabase/PostgREST roles; no real users, keys, or projects.
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid() returns uuid
 language sql stable
 as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create type public.organization_member_role as enum ('admin', 'member');

create table public.organizations (
 id uuid primary key,
 removed_at timestamptz
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id),
 profile_id uuid not null,
 member_role public.organization_member_role not null,
 primary key (organization_id, profile_id)
);
create table public.aluna_super_admins (
 profile_id uuid primary key
);
create table public.organization_access_audit (
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id),
 actor_id uuid,
 subject_id uuid,
 action text not null,
 details jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.aluna_super_admins enable row level security;
alter table public.organization_access_audit enable row level security;

-- Mirror the PR's effective grants/policies: SQL write grants may exist,
-- but NO membership INSERT/UPDATE/DELETE RLS policy exists for browser roles.
grant select on public.organizations to authenticated;
create policy "Read organizations" on public.organizations
 for select to authenticated using (removed_at is null);
grant select, insert, update, delete on public.organization_members to anon, authenticated;
create policy "Read organization people" on public.organization_members
 for select to authenticated using (true);
grant usage on type public.organization_member_role to anon, authenticated;

insert into public.organizations(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.organization_members(organization_id, profile_id, member_role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','admin'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','admin'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','admin');
insert into public.aluna_super_admins(profile_id)
 values ('11111111-1111-4111-8111-111111111111');
