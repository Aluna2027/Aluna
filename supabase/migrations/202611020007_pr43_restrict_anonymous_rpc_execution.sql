-- PR #43 release hardening: remove explicit anon EXECUTE grants on
-- SECURITY DEFINER RPCs. These RPCs require authenticated users and
-- enforce actor/administrator checks internally; anon never needs access.
-- The Supabase project granted anon EXECUTE by default even where the
-- original PR43 migration revoked only PUBLIC.
-- Do not change authenticated / service_role privileges.
REVOKE EXECUTE ON FUNCTION public.pr43_record_contributions(uuid,uuid,uuid,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pr43_review_result(uuid,uuid,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pr43_revoke_result(uuid,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pr43_impact_rollup(uuid,uuid,uuid,uuid) FROM anon;
