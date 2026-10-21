-- PR33 P0: metadata-only assertions on disposable Supabase (do not invoke any financial RPC).
\set ON_ERROR_STOP on
do $payment_acl$
declare v_signature text; v_fn oid;
begin
 foreach v_signature in array array[
   'public.record_checkout_payment_event(text,text,uuid,text,text,text,text,text,text)',
   'public.record_confirmed_donation(text,text,uuid,text,text,text,text,bigint,text,text,text,text,text,timestamptz)',
   'public.record_donation_refund(text,text,text,text,text,bigint,text)',
   'public.record_subscription_event(text,text,uuid,text,text)'
 ] loop
   v_fn := to_regprocedure(v_signature);
   if v_fn is null then raise exception 'FAIL: missing payment RPC %',v_signature; end if;
   if has_function_privilege('anon',v_fn,'EXECUTE')
      or has_function_privilege('authenticated',v_fn,'EXECUTE') then
      raise exception 'FAIL: browser role can execute payment RPC %',v_signature;
   end if;
   if not has_function_privilege('service_role',v_fn,'EXECUTE') then
      raise exception 'FAIL: service_role cannot execute payment RPC %',v_signature;
   end if;
   if not exists(select 1 from pg_proc where oid=v_fn and prosecdef) then
      raise exception 'FAIL: unexpected payment RPC mode %',v_signature;
   end if;
 end loop;
end $payment_acl$;
\echo 'PASS: four payment RPCs deny anon/authenticated and allow service_role'
