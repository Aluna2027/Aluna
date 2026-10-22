-- PR33 P0: forward-only source parity for existing Demo organization security.
-- DO NOT run against Demo or Production until separate migration-history reconciliation.
-- This file creates no Super Admin account and changes no existing organization owners.
-- The functions below preserve the currently inspected Demo behavior.
create table if not exists public.aluna_super_admins (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 granted_at timestamptz not null default now()
);
alter table public.aluna_super_admins enable row level security;
revoke all on public.aluna_super_admins from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_aluna_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.aluna_super_admins a WHERE a.profile_id = (SELECT auth.uid())
  );
$function$;
revoke all on function public.is_aluna_super_admin() from public,anon;
grant execute on function public.is_aluna_super_admin() to authenticated;

create table if not exists public.organization_admin_audit (
 id bigint generated always as identity primary key,
 organization_id uuid references public.organizations(id) on delete set null,
 organization_name text not null,
 action text not null check (action in ('archived','restored','wba_updated','protected_fields_updated')),
 performed_by uuid references public.profiles(id) on delete set null,
 previous_data jsonb not null default '{}'::jsonb,
 next_data jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);
create index if not exists organization_admin_audit_org_time_idx
 on public.organization_admin_audit(organization_id,occurred_at desc);
alter table public.organization_admin_audit enable row level security;
revoke all on public.organization_admin_audit from public,anon,authenticated;
grant select on public.organization_admin_audit to authenticated;
drop policy if exists "Aluna super admins read organization audit" on public.organization_admin_audit;
create policy "Aluna super admins read organization audit"
 on public.organization_admin_audit for select to authenticated
 using ((select public.is_aluna_super_admin()));

alter table public.organizations
 add column if not exists management_type text not null default 'aluna_managed',
 add column if not exists created_by_profile_id uuid references public.profiles(id),
 add column if not exists wba_assessment_year integer;

do $pr33_constraints$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.organizations'::regclass and conname='organizations_management_type_check') then
  alter table public.organizations add constraint organizations_management_type_check
   check (management_type in ('aluna_managed','community_created'));
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.organizations'::regclass and conname='organizations_wba_year_check') then
  alter table public.organizations add constraint organizations_wba_year_check
   check (wba_assessment_year is null or wba_assessment_year between 2000 and 2100);
 end if;
end $pr33_constraints$;
create index if not exists organizations_created_by_profile_id_idx
 on public.organizations(created_by_profile_id) where management_type='community_created';

-- Preserve the Demo-only, officially managed one-character company name exception.
alter table public.organizations drop constraint if exists organizations_name_length;
alter table public.organizations add constraint organizations_name_length check (
 char_length(name) between 2 and 160
 or (name='X' and organization_type='company'::public.organization_type
  and management_type='aluna_managed')
);

-- WBA scores must not be writable by ordinary authenticated users.
revoke insert,delete,truncate,trigger,update on public.organizations from anon,authenticated;
grant update(name,description,website,logo_url,location_text,updated_at)
 on public.organizations to authenticated;

-- Restore the exact existing Demo policy conditions: admins may edit safe fields,
-- but cannot access archived organizations or change protected columns.
alter policy "Read organizations" on public.organizations
 using (removed_at is null or (select public.is_aluna_super_admin()));
alter policy "Org admins update details" on public.organizations
 using (removed_at is null and exists(
   select 1 from public.organization_members m
   where m.organization_id=organizations.id and m.profile_id=(select auth.uid())
     and m.member_role='admin'))
 with check (removed_at is null and exists(
   select 1 from public.organization_members m
   where m.organization_id=organizations.id and m.profile_id=(select auth.uid())
     and m.member_role='admin'));

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_type organization_type, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF char_length(trim(p_name)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Name must be 2 to 160 characters'; END IF;
  IF p_type IS NULL THEN RAISE EXCEPTION 'Organization type required'; END IF;
  IF char_length(coalesce(p_description,'')) > 3000 THEN RAISE EXCEPTION 'Description too long'; END IF;
  INSERT INTO public.organizations
    (name,organization_type,description,management_type,created_by_profile_id)
  VALUES (trim(p_name),p_type,nullif(trim(coalesce(p_description,'')),''),'community_created',v_user)
  RETURNING id INTO v_id;
  INSERT INTO public.organization_members (organization_id,profile_id,member_role)
  VALUES (v_id,v_user,'admin');
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_organization_v2(p_name text, p_type organization_type, p_country text, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF char_length(trim(p_name)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Name must be 2 to 160 characters'; END IF;
  IF p_type IS NULL THEN RAISE EXCEPTION 'Organization type required'; END IF;
  IF char_length(trim(coalesce(p_country,''))) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Country required'; END IF;
  IF char_length(coalesce(p_description,'')) > 3000 THEN RAISE EXCEPTION 'Description too long'; END IF;
  INSERT INTO public.organizations
    (name,organization_type,country,description,management_type,created_by_profile_id)
  VALUES
    (trim(p_name),p_type,trim(p_country),nullif(trim(coalesce(p_description,'')),''),
     'community_created',v_user)
  RETURNING id INTO v_id;
  INSERT INTO public.organization_members (organization_id,profile_id,member_role)
  VALUES (v_id,v_user,'admin');
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.organization_has_activity(p_organization uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.actors a
    WHERE a.organization_id=p_organization
    AND (
       EXISTS (SELECT 1 FROM public.posts x WHERE x.actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.missions x WHERE x.created_by_actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.fundraising_campaigns x WHERE x.actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.fundraisers x WHERE x.actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.contributions x WHERE x.actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.proofs x WHERE x.actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.mesh_community_members x WHERE x.actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.mission_participations x WHERE x.actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.follows x WHERE x.followed_actor_id=a.id OR x.follower_actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.connections x WHERE x.actor_a=a.id OR x.actor_b=a.id)
    OR EXISTS (SELECT 1 FROM public.actor_relationships x WHERE x.source_actor_id=a.id OR x.target_actor_id=a.id)
    OR EXISTS (SELECT 1 FROM public.conversations x WHERE x.actor_a=a.id OR x.actor_b=a.id)
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_archive_organization(p_organization uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.organizations o WHERE o.id=p_organization AND o.removed_at IS NULL
     AND (
       public.is_aluna_super_admin()
       OR (
         o.management_type='community_created'
         AND o.created_by_profile_id=auth.uid()
         AND EXISTS (
            SELECT 1 FROM public.organization_members m
            WHERE m.organization_id=o.id AND m.profile_id=auth.uid() AND m.member_role='admin'
         )
         AND NOT public.organization_has_activity(o.id)
       )
     )
 );
$function$;

CREATE OR REPLACE FUNCTION public.remove_organization(p_organization uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.can_archive_organization(p_organization) THEN
     RAISE EXCEPTION 'Only Aluna Super Admin or the authorized community creator of an inactive organization may archive it'
       USING ERRCODE='42501';
  END IF;
  UPDATE public.organizations
    SET removed_at=now(),updated_at=now()
  WHERE id=p_organization AND removed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found or already archived'; END IF;
  RETURN 'removed';
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_organization(p_organization uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_aluna_super_admin() THEN
    RAISE EXCEPTION 'Only Aluna Super Admin may restore organizations'
      USING ERRCODE='42501';
  END IF;
  UPDATE public.organizations
    SET removed_at=NULL, updated_at=now()
  WHERE id=p_organization AND removed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Archived organization not found'; END IF;
  RETURN 'restored';
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_organization_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_wba_changed boolean;
  v_remove_changed boolean;
  v_metadata_changed boolean;
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_user uuid := auth.uid();
  v_trusted boolean;
BEGIN
  v_wba_changed :=
     old.wba_total_score IS DISTINCT FROM new.wba_total_score
     OR old.wba_human_rights_score IS DISTINCT FROM new.wba_human_rights_score
     OR old.wba_decent_work_score IS DISTINCT FROM new.wba_decent_work_score
     OR old.wba_acting_ethically_score IS DISTINCT FROM new.wba_acting_ethically_score
     OR old.wba_assessment_year IS DISTINCT FROM new.wba_assessment_year;
  v_remove_changed := old.removed_at IS DISTINCT FROM new.removed_at;
  v_metadata_changed := old.organization_type IS DISTINCT FROM new.organization_type
     OR old.is_verified IS DISTINCT FROM new.is_verified
     OR old.management_type IS DISTINCT FROM new.management_type
     OR old.created_by_profile_id IS DISTINCT FROM new.created_by_profile_id;
  v_trusted := public.is_aluna_super_admin()
    OR (v_user IS NULL AND v_role IN ('','service_role'));
  IF v_wba_changed OR v_remove_changed OR v_metadata_changed THEN
    IF NOT v_trusted AND NOT (
      v_remove_changed AND NOT v_wba_changed AND NOT v_metadata_changed
      AND old.removed_at IS NULL AND new.removed_at IS NOT NULL
      AND public.can_archive_organization(old.id)
    ) THEN
      RAISE EXCEPTION 'Not authorized to change protected organization fields'
        USING ERRCODE='42501';
    END IF;
    INSERT INTO public.organization_admin_audit
      (organization_id, organization_name, action, performed_by, previous_data, next_data)
    VALUES (
      old.id, old.name,
      CASE WHEN v_remove_changed
         THEN CASE WHEN new.removed_at IS NULL THEN 'restored' ELSE 'archived' END
         WHEN v_wba_changed THEN 'wba_updated'
         ELSE 'protected_fields_updated' END,
      v_user,
      jsonb_build_object(
        'removed_at',old.removed_at,'management_type',old.management_type,
        'created_by_profile_id',old.created_by_profile_id,'wba_assessment_year',old.wba_assessment_year,
        'organization_type',old.organization_type,'is_verified',old.is_verified,
        'wba_total_score',old.wba_total_score,'wba_human_rights_score',old.wba_human_rights_score,
        'wba_decent_work_score',old.wba_decent_work_score,'wba_acting_ethically_score',old.wba_acting_ethically_score
      ),
      jsonb_build_object(
        'removed_at',new.removed_at,'management_type',new.management_type,
        'created_by_profile_id',new.created_by_profile_id,'wba_assessment_year',new.wba_assessment_year,
        'organization_type',new.organization_type,'is_verified',new.is_verified,
        'wba_total_score',new.wba_total_score,'wba_human_rights_score',new.wba_human_rights_score,
        'wba_decent_work_score',new.wba_decent_work_score,'wba_acting_ethically_score',new.wba_acting_ethically_score
      )
    );
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_organization_wba(p_organization uuid, p_year integer, p_total numeric, p_human numeric, p_decent numeric, p_ethics numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_aluna_super_admin() THEN
    RAISE EXCEPTION 'Only Aluna Super Admin can edit official WBA scores'
      USING ERRCODE='42501';
  END IF;
  IF p_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Invalid WBA assessment year';
  END IF;
  IF (p_total IS NOT NULL AND (p_total < 0 OR p_total > 100))
    OR (p_human IS NOT NULL AND (p_human < 0 OR p_human > 100))
    OR (p_decent IS NOT NULL AND (p_decent < 0 OR p_decent > 100))
    OR (p_ethics IS NOT NULL AND (p_ethics < 0 OR p_ethics > 100)) THEN
    RAISE EXCEPTION 'WBA scores must be between 0 and 100';
  END IF;
  UPDATE public.organizations SET
     wba_assessment_year=p_year,
     wba_total_score=p_total / 10,
     wba_human_rights_score=p_human / 10,
     wba_decent_work_score=p_decent / 10,
     wba_acting_ethically_score=p_ethics / 10,
     updated_at=now()
  WHERE id=p_organization AND organization_type='company' AND removed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active company not found';
  END IF;
END;
$function$;
revoke all on function public.create_organization(text,public.organization_type,text)
 from public,anon;
revoke all on function public.create_organization_v2(text,public.organization_type,text,text)
 from public,anon;
grant execute on function public.create_organization(text,public.organization_type,text) to authenticated;
grant execute on function public.create_organization_v2(text,public.organization_type,text,text) to authenticated;
revoke all on function public.organization_has_activity(uuid) from public,anon,authenticated;
revoke all on function public.can_archive_organization(uuid) from public,anon;
grant execute on function public.can_archive_organization(uuid) to authenticated;
revoke all on function public.remove_organization(uuid) from public,anon;
grant execute on function public.remove_organization(uuid) to authenticated;
revoke all on function public.restore_organization(uuid) from public,anon;
grant execute on function public.restore_organization(uuid) to authenticated;
revoke all on function public.update_organization_wba(uuid,integer,numeric,numeric,numeric,numeric)
 from public,anon;
grant execute on function public.update_organization_wba(uuid,integer,numeric,numeric,numeric,numeric)
 to authenticated;
revoke all on function public.protect_organization_fields() from public,anon,authenticated;
drop trigger if exists protect_organization_fields on public.organizations;
create trigger protect_organization_fields before update on public.organizations
 for each row execute function public.protect_organization_fields();

-- WBA range constraints were also applied in Demo's original Phase 19 setup.
do $pr33_wba_bounds$
declare c text;
begin
 foreach c in array array['organizations_wba_total_range','organizations_wba_human_rights_range','organizations_wba_decent_work_range','organizations_wba_ethics_range']
 loop
  if not exists(select 1 from pg_constraint where conrelid='public.organizations'::regclass and conname=c) then
   execute format('alter table public.organizations add constraint %I check (%I is null or %I between 0 and 10)',
     c,
     case c when 'organizations_wba_total_range' then 'wba_total_score'
            when 'organizations_wba_human_rights_range' then 'wba_human_rights_score'
            when 'organizations_wba_decent_work_range' then 'wba_decent_work_score'
            else 'wba_acting_ethically_score' end,
     case c when 'organizations_wba_total_range' then 'wba_total_score'
            when 'organizations_wba_human_rights_range' then 'wba_human_rights_score'
            when 'organizations_wba_decent_work_range' then 'wba_decent_work_score'
            else 'wba_acting_ethically_score' end);
  end if;
 end loop;
end $pr33_wba_bounds$;
