-- PR #33 security follow-up.
-- This migration preserves legacy profiles and public profile presentation while
-- narrowing direct access to sensitive profile columns and privileged RPCs.

-- Existing profiles are grandfathered because demographics were added after
-- onboarding was first deployed. New profiles inherit true from this point on.
alter table public.profiles
  add column if not exists demographics_required boolean not null default false;

-- New Auth users are explicitly marked for the current required-demographics
-- onboarding. Existing profile rows keep the safe legacy default of false.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name,demographics_required)
  values(new.id,coalesce(split_part(new.email,'@',1),'Member'),true);
  return new;
end $$;

-- Base profile rows are private to their owner. A deliberately limited view
-- continues to expose the existing public profile fields to signed-in members.
drop policy if exists "Read member profiles" on public.profiles;
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
revoke select on public.profiles from public, anon;

create or replace view public.public_profiles
with (security_barrier = true)
as
select id, display_name, first_name, last_name, bio, avatar_url,
       created_at, updated_at, location_text, website, skills, interests,
       onboarded_at, aluna_role
from public.profiles;
comment on view public.public_profiles is
  'Public profile projection. Owned by the database migration role so it can list profiles; intentionally excludes date_of_birth, gender, and demographics_required.';
revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- Retire the old onboarding endpoints as public API entry points. v4 remains
-- callable by authenticated users and can invoke v3 internally as its owner.
revoke all on function public.complete_member_onboarding(text,text,text,text,text[],text[])
  from public, anon, authenticated;
revoke all on function public.complete_member_onboarding_v2(text,text,text,text,text[],text[],public.aluna_member_role)
  from public, anon, authenticated;
revoke all on function public.complete_member_onboarding_v3(text,text,text,text,text,text,text[],text[],public.aluna_member_role)
  from public, anon, authenticated;

create or replace function public.complete_member_onboarding_v4(
 p_display_name text,p_first_name text,p_last_name text,p_avatar text,
 p_location text,p_bio text,p_skills text[],p_interests text[],
 p_aluna_role public.aluna_member_role,p_date_of_birth date,p_gender text
) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid := auth.uid();
begin
 if v_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_date_of_birth is null or p_date_of_birth > current_date
    or p_gender is null or p_gender not in ('male','female','prefer_not_to_say')
 then raise exception 'Date of birth and gender selection are required' using errcode='22023'; end if;
 perform public.complete_member_onboarding_v3(
  p_display_name,p_first_name,p_last_name,p_avatar,p_location,p_bio,
  p_skills,p_interests,p_aluna_role);
 update public.profiles
    set date_of_birth=p_date_of_birth, gender=p_gender, demographics_required=true
  where id=v_id;
 if not found then raise exception 'Profile unavailable'; end if;
end $$;
revoke all on function public.complete_member_onboarding_v4(
 text,text,text,text,text,text,text[],text[],public.aluna_member_role,date,text)
 from public, anon;
grant execute on function public.complete_member_onboarding_v4(
 text,text,text,text,text,text,text[],text[],public.aluna_member_role,date,text)
 to authenticated;

-- The previous function had an auth.uid() guard, but anon had no reason to be
-- granted EXECUTE. Preserve the normal signed-in organization creation flow.
revoke execute on function public.create_organization(text,public.organization_type,text)
  from public, anon;
grant execute on function public.create_organization(text,public.organization_type,text)
  to authenticated;

-- Deduplicate referral clicks per hashed client IP, link, source, and UTC day.
-- The hash is produced only in the Vercel server route; raw IPs are not stored.
create table if not exists public.referral_click_dedup (
  link_kind text not null check (link_kind in ('campaign','fundraiser')),
  referral_link_id uuid not null,
  source text not null check (source in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy')),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  visit_date date not null,
  created_at timestamptz not null default now(),
  primary key (link_kind, referral_link_id, source, visitor_hash, visit_date)
);
create index if not exists referral_click_dedup_recent_idx
  on public.referral_click_dedup(link_kind, referral_link_id, visit_date);
alter table public.referral_click_dedup enable row level security;
revoke all on public.referral_click_dedup from public, anon, authenticated;

create or replace function public.visit_campaign_referral(
 p_token text,p_source text,p_visitor_hash text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_link uuid; v_campaign uuid; v_inserted integer;
begin
 if p_source is null or p_source not in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy')
    or p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then return null; end if;
 select l.id,l.campaign_id into v_link,v_campaign
 from public.campaign_referral_links l
 join public.fundraising_campaigns c on c.id=l.campaign_id
 where l.token=p_token and l.is_active=true and c.removed_at is null and c.archived_at is null;
 if v_link is null then return null; end if;
 delete from public.referral_click_dedup
  where link_kind='campaign' and referral_link_id=v_link and visit_date < (now() at time zone 'utc')::date - 1;
 insert into public.referral_click_dedup(link_kind,referral_link_id,source,visitor_hash,visit_date)
 values('campaign',v_link,p_source,p_visitor_hash,(now() at time zone 'utc')::date)
 on conflict do nothing;
 get diagnostics v_inserted = row_count;
 if v_inserted=1 then
  insert into public.campaign_referral_source_counts(referral_link_id,source,clicks)
  values(v_link,p_source,1)
  on conflict(referral_link_id,source) do update
   set clicks=public.campaign_referral_source_counts.clicks+1,updated_at=now();
 end if;
 return v_campaign;
end $$;
revoke all on function public.visit_campaign_referral(text,text) from public, anon, authenticated;
revoke all on function public.visit_campaign_referral(text,text,text) from public, anon, authenticated;
grant execute on function public.visit_campaign_referral(text,text,text) to service_role;

create or replace function public.visit_fundraiser_referral(
 p_token text,p_source text,p_visitor_hash text
) returns text language plpgsql security definer set search_path='' as $$
declare v_link uuid; v_slug text; v_inserted integer;
begin
 if p_source is null or p_source not in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy')
    or p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then return null; end if;
 select l.id,f.slug into v_link,v_slug
 from public.fundraiser_referral_links l
 join public.fundraisers f on f.id=l.fundraiser_id
 where l.token=p_token;
 if v_link is null then return null; end if;
 delete from public.referral_click_dedup
  where link_kind='fundraiser' and referral_link_id=v_link and visit_date < (now() at time zone 'utc')::date - 1;
 insert into public.referral_click_dedup(link_kind,referral_link_id,source,visitor_hash,visit_date)
 values('fundraiser',v_link,p_source,p_visitor_hash,(now() at time zone 'utc')::date)
 on conflict do nothing;
 get diagnostics v_inserted = row_count;
 if v_inserted=1 then
  insert into public.referral_source_counts(referral_link_id,source,clicks)
  values(v_link,p_source,1)
  on conflict(referral_link_id,source) do update
   set clicks=public.referral_source_counts.clicks+1,updated_at=now();
 end if;
 return v_slug;
end $$;
revoke all on function public.visit_fundraiser_referral(text,text) from public, anon, authenticated;
revoke all on function public.visit_fundraiser_referral(text,text,text) from public, anon, authenticated;
grant execute on function public.visit_fundraiser_referral(text,text,text) to service_role;

-- Remove unnecessary anonymous access from the Advisor's complete current
-- SECURITY DEFINER inventory. Trigger functions are internal trigger entry
-- points and must not be callable as standalone RPCs. The two exceptions are
-- deliberate: the PostgREST suspension pre-request guard and public campaign
-- totals. Referral visits are now server-only above.
do $$
declare r record;
begin
 for r in
  select p.oid::regprocedure as signature,
         exists(select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal) as is_trigger
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and (
      has_function_privilege('anon',p.oid,'EXECUTE')
      or exists(select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal)
    )
    and p.oid not in (
      'public.aluna_require_active_data_api_session()'::regprocedure,
      'public.fundraising_totals(uuid)'::regprocedure
    )
 loop
  if r.is_trigger then
   execute format('revoke all on function %s from public, anon, authenticated',r.signature);
  else
   execute format('revoke execute on function %s from public, anon',r.signature);
  end if;
 end loop;
end $$;

revoke all on function public.aluna_require_active_data_api_session() from public;
grant execute on function public.aluna_require_active_data_api_session() to anon, authenticated;
revoke all on function public.fundraising_totals(uuid) from public;
grant execute on function public.fundraising_totals(uuid) to anon, authenticated;
