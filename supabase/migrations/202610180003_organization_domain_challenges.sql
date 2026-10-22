create table if not exists public.organization_domain_challenges (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 domain text not null,
 challenge_hash text not null,
 requested_by uuid not null references auth.users(id),
 requested_at timestamptz not null default now(),
 expires_at timestamptz not null,
 verified_at timestamptz,
 constraint org_domain_challenge_format check (domain=lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$' and domain like '%.%' and domain not like '%..%')
);
create index if not exists org_domain_challenges_lookup on public.organization_domain_challenges(organization_id,domain,requested_at desc);
alter table public.organization_domain_challenges enable row level security;
revoke all on public.organization_domain_challenges from public,anon,authenticated;
grant select,insert,update on public.organization_domain_challenges to service_role;
