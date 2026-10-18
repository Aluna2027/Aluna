create table if not exists public.aluna_profile_moderation_audit (
 id bigint generated always as identity primary key,
 profile_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id),
 action text not null check (action in ('suspended','reactivated')),
 reason text not null check (char_length(trim(reason)) between 8 and 500),
 occurred_at timestamptz not null default now()
);
alter table public.aluna_profile_moderation_audit enable row level security;
revoke all on public.aluna_profile_moderation_audit from public,anon,authenticated;
grant select,insert on public.aluna_profile_moderation_audit to service_role;
grant usage,select on sequence public.aluna_profile_moderation_audit_id_seq to service_role;
create index if not exists aluna_profile_moderation_audit_profile on public.aluna_profile_moderation_audit(profile_id,occurred_at desc);
