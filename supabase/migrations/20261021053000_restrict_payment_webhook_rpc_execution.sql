-- PR33 P0: grant only service_role EXECUTE on privileged payment ledger RPCs.
-- Supabase default ACLs directly grant anon/authenticated EXECUTE; revoking PUBLIC alone is insufficient.
-- ACL-only change: no mutation of payment data, function bodies, or Stripe webhook code.

revoke all on function public.record_checkout_payment_event(text,text,uuid,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.record_confirmed_donation(text,text,uuid,text,text,text,text,bigint,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.record_donation_refund(text,text,text,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.record_subscription_event(text,text,uuid,text,text) from public, anon, authenticated;

-- Preserve the verified Stripe webhook's service_role client access.
grant execute on function public.record_checkout_payment_event(text,text,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.record_confirmed_donation(text,text,uuid,text,text,text,text,bigint,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.record_donation_refund(text,text,text,text,text,bigint,text) to service_role;
grant execute on function public.record_subscription_event(text,text,uuid,text,text) to service_role;
