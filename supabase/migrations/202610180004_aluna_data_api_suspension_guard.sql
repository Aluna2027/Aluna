-- Step 2 acceptance: reject suspended / deleted authenticated accounts at
-- the PostgREST gateway, including SECURITY DEFINER RPC endpoints.
-- Stage 1 creates and tests the hook before enabling it.
create or replace function public.aluna_require_active_data_api_session()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_subject uuid;
begin
  -- Anon and service-role requests retain their existing permission model.
  -- PostgREST validates JWT signatures before assigning these trusted claims.
  if v_claims ->> 'role' is distinct from 'authenticated' then
    return;
  end if;

  v_subject := auth.uid();
  if v_subject is null or not exists (
    select 1 from auth.users u
    where u.id = v_subject
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'Aluna account is suspended or unavailable'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.aluna_require_active_data_api_session()
from public, anon, authenticated;
grant execute on function public.aluna_require_active_data_api_session()
to anon, authenticated;
