-- Activate the DB-backed suspension check for Supabase PostgREST.
-- Scope: Data API only; Storage and Realtime require separate access reviews.
-- Rollback (explicit): ALTER ROLE authenticator RESET pgrst.db_pre_request;
--                        NOTIFY pgrst, 'reload config';
alter role authenticator set pgrst.db_pre_request = 'public.aluna_require_active_data_api_session';
notify pgrst, 'reload config';
