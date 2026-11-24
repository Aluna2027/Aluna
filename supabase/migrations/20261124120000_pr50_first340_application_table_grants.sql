begin;

-- Anonymous visitors have no First 340 application workflow and must not access
-- application records directly, regardless of row-level security policies.
revoke all privileges on table public.first340_applications from anon;

-- Authenticated applicants retain SELECT (subject to RLS) and the existing
-- column-scoped UPDATE grants for draft fields. Remove unrelated table powers.
revoke delete, truncate, references, trigger, maintain
  on table public.first340_applications from authenticated;

commit;
