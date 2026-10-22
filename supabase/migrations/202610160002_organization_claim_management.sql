-- PR #25C.1: private organization access workflow.
-- No privileges for browser roles. Only trusted server requests may use these objects.
create table if not exists public.organization_verified_domains (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 domain text not null,
 approved_by uuid references auth.users(id),
 approved_at timestamptz not null default now(),
 primary key (organization_id,domain),
 constraint organization_domain_valid check (domain=lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$' and domain like '%.%' and domain not like '%..%')
);
create table if not exists public.organization_claim_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 requester_id uuid not null references auth.users(id),
 requester_email text not null,
 domain text not null,
 status text not null default 'needs_review' check (status in ('needs_review','dns_pending','approved','rejected')),
 challenge text,
 challenge_expires_at timestamptz,
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id)
);
create unique index if not exists org_one_pending_claim on public.organization_claim_requests(organization_id,requester_id) where status in ('needs_review','dns_pending');
create table if not exists public.organization_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 recipient_email text not null,
 token_hash text not null unique,
 invited_by uuid not null references auth.users(id),
 expires_at timestamptz not null,
 redeemed_at timestamptz,
 redeemed_by uuid references auth.users(id),
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.organization_access_audit (
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id),
 actor_id uuid references auth.users(id),
 subject_id uuid references auth.users(id),
 action text not null,
 occurred_at timestamptz not null default now(),
 details jsonb not null default '{}'::jsonb
);
create index if not exists org_claim_status on public.organization_claim_requests(status,created_at);
create index if not exists org_invite_org on public.organization_invitations(organization_id,created_at desc);
alter table public.organization_verified_domains enable row level security;
alter table public.organization_claim_requests enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_access_audit enable row level security;
revoke all on public.organization_verified_domains,public.organization_claim_requests,public.organization_invitations,public.organization_access_audit from public,anon,authenticated;
grant all on public.organization_verified_domains,public.organization_claim_requests,public.organization_invitations,public.organization_access_audit to service_role;
grant usage,select on sequence public.organization_access_audit_id_seq to service_role;

-- Redeem hashed, one-time invitation atomically. Caller uses trusted service-role
-- code which checks the authenticated requester's verified email before invocation.
create or replace function public.redeem_organization_invitation(p_hash text,p_profile uuid,p_email text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_inv public.organization_invitations%rowtype; v_org uuid;
begin
 select * into v_inv from public.organization_invitations
  where token_hash=p_hash for update;
 if not found or v_inv.revoked_at is not null or v_inv.redeemed_at is not null or v_inv.expires_at<=now()
  then return null; end if;
 if lower(v_inv.recipient_email)<>lower(p_email) then return null; end if;
 if not exists(select 1 from auth.users where id=p_profile and email_confirmed_at is not null and lower(email)=lower(p_email)) then return null; end if;
 select id into v_org from public.organizations where id=v_inv.organization_id and removed_at is null;
 if v_org is null then return null; end if;
 insert into public.organization_members(organization_id,profile_id,member_role)
 values(v_org,p_profile,'admin')
 on conflict(organization_id,profile_id) do update set member_role='admin';
 update public.organization_invitations set redeemed_at=now(),redeemed_by=p_profile where id=v_inv.id;
 insert into public.organization_access_audit(organization_id,actor_id,subject_id,action)
 values(v_org,p_profile,p_profile,'invitation_accepted');
 return v_org;
end $$;
revoke all on function public.redeem_organization_invitation(text,uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_organization_invitation(text,uuid,text) to service_role;

-- First-admin claims use a lock so two parallel requests cannot both become first admin.
create or replace function public.approve_first_organization_claim(p_claim uuid,p_actor uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_req public.organization_claim_requests%rowtype;
begin
 select * into v_req from public.organization_claim_requests where id=p_claim for update;
 if not found or v_req.status not in ('needs_review','dns_pending') then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_req.organization_id::text,0));
 if not exists(select 1 from public.organizations where id=v_req.organization_id and removed_at is null) then return null; end if;
 if exists(select 1 from public.organization_members where organization_id=v_req.organization_id and member_role='admin') then return null; end if;
 if not exists(select 1 from auth.users where id=v_req.requester_id and email_confirmed_at is not null and lower(email)=lower(v_req.requester_email)) then return null; end if;
 insert into public.organization_members(organization_id,profile_id,member_role)
 values(v_req.organization_id,v_req.requester_id,'admin')
 on conflict(organization_id,profile_id) do update set member_role='admin';
 update public.organization_claim_requests set status='approved',decided_at=now(),decided_by=p_actor where id=p_claim;
 insert into public.organization_access_audit(organization_id,actor_id,subject_id,action)
 values(v_req.organization_id,p_actor,v_req.requester_id,'claim_approved');
 return v_req.organization_id;
end $$;
revoke all on function public.approve_first_organization_claim(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_first_organization_claim(uuid,uuid) to service_role;
