-- Roles classify accounts for display. Organization membership grants access separately.
create type public.account_role as enum ('user', 'university', 'ngo', 'company');
create type public.organization_kind as enum ('university', 'ngo', 'company');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.account_role not null default 'user',
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.organization_kind not null,
  description text,
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);
-- A minimal place anchor for later city and community records.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code varchar(2) not null check (country_code ~ '^[A-Z]{2}$'),
  parent_id uuid references public.places(id),
  created_at timestamptz not null default now()
);
create index places_country_idx on public.places(country_code);
create index organization_members_profile_idx on public.organization_members(profile_id);

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(split_part(new.email, '@', 1), 'Member'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.places enable row level security;
create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Read organizations" on public.organizations for select to authenticated using (true);
create policy "Read own memberships" on public.organization_members for select to authenticated using (profile_id = (select auth.uid()));
create policy "Read places" on public.places for select to authenticated using (true);
-- Membership and institutional roles are provisioned by trusted administrators in later phases.
revoke update on public.profiles from authenticated;
grant update (display_name, bio, avatar_url) on public.profiles to authenticated;
