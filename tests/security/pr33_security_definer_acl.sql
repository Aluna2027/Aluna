-- Metadata-only PR #33 regression checks. Do not invoke any write RPC here.
\set ON_ERROR_STOP on
do $security_definer_acl$
declare r record; v_fn oid;
begin
 for r in
  select p.oid,p.oid::regprocedure::text as signature,
         coalesce(array_to_string(p.proconfig,','),'') as config,
         exists(select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal) as is_trigger
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
 loop
  if r.config not like '%search_path=%' then
   raise exception 'FAIL: SECURITY DEFINER function has no pinned search_path: %',r.signature;
  end if;
  if has_function_privilege('anon',r.oid,'EXECUTE') and r.signature not in (
    'aluna_require_active_data_api_session()',
    'fundraising_totals(uuid)'
  ) then raise exception 'FAIL: unexpected anon EXECUTE on %',r.signature; end if;
  if r.is_trigger and (has_function_privilege('anon',r.oid,'EXECUTE') or has_function_privilege('authenticated',r.oid,'EXECUTE')) then
   raise exception 'FAIL: trigger function is directly callable as RPC: %',r.signature;
  end if;
 end loop;

 v_fn:=to_regprocedure('public.create_organization(text,public.organization_type,text)');
 if v_fn is null or has_function_privilege('anon',v_fn,'EXECUTE') or not has_function_privilege('authenticated',v_fn,'EXECUTE') then
  raise exception 'FAIL: create_organization ACL is not least-privilege';
 end if;

 foreach v_fn in array array[
  to_regprocedure('public.complete_member_onboarding(text,text,text,text,text[],text[])'),
  to_regprocedure('public.complete_member_onboarding_v2(text,text,text,text,text[],text[],public.aluna_member_role)'),
  to_regprocedure('public.complete_member_onboarding_v3(text,text,text,text,text,text,text[],text[],public.aluna_member_role)')
 ] loop
  if v_fn is not null and (has_function_privilege('anon',v_fn,'EXECUTE') or has_function_privilege('authenticated',v_fn,'EXECUTE')) then
   raise exception 'FAIL: retired onboarding RPC remains directly executable: %',v_fn::regprocedure;
  end if;
 end loop;
 v_fn:=to_regprocedure('public.complete_member_onboarding_v4(text,text,text,text,text,text,text[],text[],public.aluna_member_role,date,text)');
 if v_fn is null or has_function_privilege('anon',v_fn,'EXECUTE') or not has_function_privilege('authenticated',v_fn,'EXECUTE') then
  raise exception 'FAIL: current onboarding RPC ACL is incorrect';
 end if;

 if has_function_privilege('anon','public.visit_campaign_referral(text,text,text)'::regprocedure,'EXECUTE')
    or has_function_privilege('authenticated','public.visit_campaign_referral(text,text,text)'::regprocedure,'EXECUTE')
    or not has_function_privilege('service_role','public.visit_campaign_referral(text,text,text)'::regprocedure,'EXECUTE') then
  raise exception 'FAIL: campaign referral counter is not server-only';
 end if;
 if has_function_privilege('anon','public.visit_fundraiser_referral(text,text,text)'::regprocedure,'EXECUTE')
    or has_function_privilege('authenticated','public.visit_fundraiser_referral(text,text,text)'::regprocedure,'EXECUTE')
    or not has_function_privilege('service_role','public.visit_fundraiser_referral(text,text,text)'::regprocedure,'EXECUTE') then
  raise exception 'FAIL: fundraiser referral counter is not server-only';
 end if;

 if has_table_privilege('anon','public.profiles','SELECT') then raise exception 'FAIL: anon can select base profiles'; end if;
 if not has_table_privilege('authenticated','public.profiles','SELECT') then raise exception 'FAIL: authenticated own-profile access was removed'; end if;
 if has_table_privilege('anon','public.public_profiles','SELECT') then raise exception 'FAIL: anon can query the public profile view'; end if;
 if not has_table_privilege('authenticated','public.public_profiles','SELECT') then raise exception 'FAIL: signed-in public profile view is unavailable'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='public_profiles' and column_name in ('date_of_birth','gender','demographics_required')) then
  raise exception 'FAIL: sensitive demographic fields are exposed by public_profiles';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Read own profile' and cmd='SELECT' and qual like '%auth.uid%') then
  raise exception 'FAIL: base profiles no longer have owner-only SELECT policy';
 end if;
end $security_definer_acl$;
\echo 'PASS: SECURITY DEFINER ACL, onboarding, referral RPC, and profile privacy assertions'
