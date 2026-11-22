-- Temporary GitHub Actions PostgreSQL fixture ONLY, not a Supabase migration.
\set ON_ERROR_STOP on
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.auth_user',true),'')::uuid
$$;
create role authenticated;
create role anon;
create table public.actors(id uuid primary key,owner_id uuid not null references auth.users(id));
create table public.posts(id uuid primary key,actor_id uuid not null references public.actors(id),visibility text not null);
create table public.comments(
 id uuid primary key,post_id uuid not null references public.posts(id),
 actor_id uuid not null references public.actors(id),
 body text not null check(length(body) between 1 and 2000),
 mention_refs jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create table public.comment_mentions(
 comment_id uuid not null references public.comments(id) on delete cascade,
 actor_id uuid not null references public.actors(id),start_offset integer not null,label text not null,
 primary key(comment_id,start_offset)
);
create table public.notifications(
 id uuid primary key, kind text not null,target_id uuid,recipient_actor_id uuid not null
);
create function public.can_act_as(p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.actors a where a.id=p_actor and a.owner_id=auth.uid())
$$;
create function public.can_view_post(p_post uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.posts p where p.id=p_post
 and (p.visibility='public' or public.can_act_as(p.actor_id)))
$$;
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.actors values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.posts values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','public'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','members');
insert into public.comments(id,post_id,actor_id,body) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','First'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Secret');
-- Existing notification should remain when its mention survives; obsolete should disappear.
insert into public.comment_mentions values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,'Bob');
insert into public.notifications values
 ('33333333-3333-4333-8333-333333333333','comment_mention','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
-- Bind fixture user IDs through a backend-only local test setting.
select set_config('test.auth_user','11111111-1111-4111-8111-111111111111',false);
