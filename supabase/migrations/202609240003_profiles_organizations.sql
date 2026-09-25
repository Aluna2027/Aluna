-- Phase 3: public-facing profiles and one shared institutional profile model.
alter table public.organizations rename column kind to organization_type;
alter type public.organization_kind rename to organization_type;

alter table public.profiles add column location_text text;
alter table public.profiles add column website text;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) between 1 and 120);
alter table public.profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 2000);
-- The original account role is not an organization authorization mechanism.
-- Membership is the sole authority for editing an organization.
alter table public.organizations add column website text;
alter table public.organizations add column is_verified boolean not null default false;
alter table public.organizations add column logo_url text;
alter table public.organizations add column location_text text;
alter table public.organizations add column place_id uuid references public.places(id) on delete set null;
alter table public.organizations add column updated_at timestamptz not null default now();
alter table public.organizations add constraint organizations_name_length check (char_length(name) between 2 and 160);
alter table public.organizations add constraint organizations_description_length check (description is null or char_length(description) <= 3000);
create index organizations_type_idx on public.organizations(organization_type);
create index organizations_place_idx on public.organizations(place_id);

create type public.organization_member_role as enum ('admin', 'member');
alter table public.organization_members add column member_role public.organization_member_role not null default 'member';

-- Public profile fields are readable by signed-in members; private email stays in auth.users.
drop policy "Read own profile" on public.profiles;
create policy "Read member profiles" on public.profiles for select to authenticated using (true);
drop policy "Read own memberships" on public.organization_members;
create policy "Read organization people" on public.organization_members for select to authenticated using (true);

-- Authenticated users may edit only harmless personal fields; role and identity remain protected.
grant update (display_name, bio, avatar_url, location_text, website, updated_at) on public.profiles to authenticated;
create policy "Org admins update details" on public.organizations for update to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = id and m.profile_id = (select auth.uid()) and m.member_role = 'admin'
))
with check (exists (
  select 1 from public.organization_members m
  where m.organization_id = id and m.profile_id = (select auth.uid()) and m.member_role = 'admin'
));
-- Restrict editable columns so membership cannot be used to switch organization type.
revoke update on public.organizations from authenticated;
grant update (name, description, website, logo_url, location_text, updated_at) on public.organizations to authenticated;

-- Organization creation is atomic: the creator becomes its first admin.
create function public.create_organization(p_name text, p_type public.organization_type, p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_name)) not between 2 and 160 then raise exception 'Name must be 2 to 160 characters'; end if;
  if p_type is null then raise exception 'Organization type required'; end if;
  if char_length(coalesce(p_description,'')) > 3000 then raise exception 'Description too long'; end if;
  insert into public.organizations (name, organization_type, description)
  values (trim(p_name), p_type, nullif(trim(coalesce(p_description,'')),'')) returning id into v_id;
  insert into public.organization_members (organization_id, profile_id, member_role)
  values (v_id, v_user, 'admin');
  return v_id;
end;
$$;
revoke all on function public.create_organization(text,public.organization_type,text) from public;
grant execute on function public.create_organization(text,public.organization_type,text) to authenticated;
-- Future invitations and verification must use their own authorized workflow.
