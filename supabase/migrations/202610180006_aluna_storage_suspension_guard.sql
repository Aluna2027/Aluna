-- Supabase Storage does not use the PostgREST db_pre_request hook.
-- Restrict authenticated object operations by the current Auth account status.
-- Existing bucket/ownership policies remain in force (ANDed with this guard).
create or replace function public.aluna_is_active_account()
returns boolean language sql stable security definer set search_path = ''
as $$
 select (select auth.uid()) is not null and exists (
   select 1 from auth.users u
   where u.id = (select auth.uid())
   and (u.banned_until is null or u.banned_until <= now())
 );
$$;
revoke all on function public.aluna_is_active_account() from public,anon,authenticated;
grant execute on function public.aluna_is_active_account() to authenticated;

create policy "Aluna active account required for storage"
on storage.objects as restrictive for all to authenticated
using ((select public.aluna_is_active_account()))
with check ((select public.aluna_is_active_account()));
