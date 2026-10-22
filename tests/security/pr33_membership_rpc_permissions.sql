-- PR33: metadata-only ACL regression checks; do not invoke the RPCs.
\set ON_ERROR_STOP on
do $membership_rpc_acl$
declare
 v_signature text;
 v_fn oid;
begin
 foreach v_signature in array array[
   'public.is_mesh_member(uuid,uuid)',
   'public.is_mission_participant(uuid,uuid)'
 ] loop
   v_fn := to_regprocedure(v_signature);
   if v_fn is null then
     raise exception 'FAIL: missing membership helper RPC %',v_signature;
   end if;
   if has_function_privilege('anon',v_fn,'EXECUTE') then
     raise exception 'FAIL: anon can execute membership helper RPC %',v_signature;
   end if;
   if not has_function_privilege('authenticated',v_fn,'EXECUTE') then
     raise exception 'FAIL: authenticated cannot execute RLS membership helper RPC %',v_signature;
   end if;
   if not exists(select 1 from pg_proc where oid=v_fn and prosecdef) then
     raise exception 'FAIL: membership helper unexpectedly stopped being SECURITY DEFINER: %',v_signature;
   end if;
 end loop;
end $membership_rpc_acl$;
\echo 'PASS: membership helper RPCs deny anon and preserve authenticated RLS access'
