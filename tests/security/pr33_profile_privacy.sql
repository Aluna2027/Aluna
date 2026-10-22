-- Isolated cross-account privacy test. Synthetic Auth users and all changes
-- are rolled back; run only against a disposable migrated database.
\set ON_ERROR_STOP on
begin;
insert into auth.users (
 instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values
 ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555551',
  'authenticated','authenticated','privacy-owner@pr33.invalid','',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','66666666-6666-4666-8666-666666666662',
  'authenticated','authenticated','privacy-other@pr33.invalid','',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555551',true);
do $$
begin
 if not exists(select 1 from public.profiles where id='55555555-5555-4555-8555-555555555551') then
  raise exception 'Authenticated owner cannot read own profile';
 end if;
 if exists(select 1 from public.profiles where id='66666666-6666-4666-8666-666666666662') then
  raise exception 'Authenticated user can read another profile row, including private demographics';
 end if;
 if not exists(select 1 from public.public_profiles where id='66666666-6666-4666-8666-666666666662') then
  raise exception 'Safe public profile fields disappeared from signed-in profile pages';
 end if;
end $$;
rollback;
\echo 'PASS: authenticated users read own sensitive profile row only; public profile view remains visible'
