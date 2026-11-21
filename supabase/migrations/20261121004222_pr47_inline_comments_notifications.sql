-- Enable a single shared client subscription; delivery still uses notification SELECT RLS.
-- Additive only; do not execute without owner approval on verified Demo target.
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
  alter publication supabase_realtime add table public.notifications;
 end if;
end $$;
