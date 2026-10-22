-- P0 organization protection against the actual, fully migrated local Supabase schema.
-- No external database, no personal accounts, and no persistent changes.
\set ON_ERROR_STOP on
do $$
begin
 if to_regclass('public.aluna_super_admins') is null
    or to_regclass('public.organization_admin_audit') is null
 then raise exception 'FAIL: missing organization security tables';end if;
 if not exists(select 1 from pg_class where oid='public.aluna_super_admins'::regclass and relrowsecurity)
    or not exists(select 1 from pg_class where oid='public.organization_admin_audit'::regclass and relrowsecurity)
 then raise exception 'FAIL: missing organization security RLS';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.organizations'::regclass
    and tgname='protect_organization_fields' and not tgisinternal)
 then raise exception 'FAIL: missing WBA/ownership protection trigger';end if;
 if has_column_privilege('authenticated','public.organizations','wba_total_score','UPDATE')
    or has_column_privilege('authenticated','public.organizations','wba_assessment_year','UPDATE')
 then raise exception 'FAIL: browser role can edit protected WBA columns';end if;
 if not has_column_privilege('authenticated','public.organizations','description','UPDATE')
 then raise exception 'FAIL: ordinary organization description editing removed';end if;
 if has_table_privilege('authenticated','public.aluna_super_admins','INSERT')
    or has_table_privilege('authenticated','public.organization_admin_audit','INSERT')
 then raise exception 'FAIL: protected administration tables writable by browser';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.organizations'::regclass
    and conname='organizations_management_type_check')
    or not exists(select 1 from pg_constraint where conrelid='public.organizations'::regclass
    and conname='organizations_wba_year_check')
 then raise exception 'FAIL: organization ownership/year constraints absent';end if;
 if to_regprocedure('public.can_archive_organization(uuid)') is null
    or to_regprocedure('public.update_organization_wba(uuid,integer,numeric,numeric,numeric,numeric)') is null
 then raise exception 'FAIL: management authorization RPCs missing';end if;
end $$;
\echo 'PASS: full-schema WBA permission, org audit, ownership and trigger invariants'

-- Synthetic pre-upgrade organizations cannot be modified by ordinary browser roles.
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',true);
set local role authenticated;
do $$
begin
 begin
  update public.organizations set wba_total_score=5
   where id='22222222-2222-4222-8222-222222222221';
  raise exception 'FAIL: browser role updated protected WBA score';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.remove_organization('22222222-2222-4222-8222-222222222221');
  raise exception 'FAIL: ordinary organization admin removed managed organization';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
\echo 'PASS: ordinary authenticated member cannot tamper with WBA or archive managed org'

do $$
begin
 if exists(select 1 from public.organizations where id='22222222-2222-4222-8222-222222222221'
   and (wba_total_score is not null or removed_at is not null))
 then raise exception 'FAIL: protected organization changed during QA';end if;
end $$;
\echo 'PASS: synthetic organizations preserved'
