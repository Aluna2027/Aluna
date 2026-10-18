-- PR #25A — PREPARED ONLY. Do not apply to production before acceptance tests.
-- Scheduled posts are private until the atomic publisher creates a normal post.
-- The eventual post id equals the scheduled id so existing private storage paths
-- become readable only under the existing can_view_post storage policy.
create table public.scheduled_posts (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.actors(id) on delete cascade,
 body text not null check (char_length(trim(body)) between 1 and 5000),
 visibility text not null default 'public' check (visibility in ('public','followers')),
 repost_of_id uuid references public.posts(id) on delete set null,
 community_id uuid references public.mesh_communities(id) on delete set null,
 mission_id uuid references public.missions(id) on delete set null,
 scheduled_for timestamptz not null,
 status text not null default 'draft' check(status in ('draft','pending','published','canceled','failed')),
 media_path text,
 media_type text check (media_type is null or media_type in ('image','video','document')),
 published_post_id uuid references public.posts(id) on delete set null,
 attempt_count integer not null default 0,
 retry_after timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint scheduled_media_pair check ((media_path is null) = (media_type is null)),
 constraint scheduled_one_context check (community_id is null or mission_id is null)
);
create index scheduled_posts_pending_idx
 on public.scheduled_posts(scheduled_for,id) where status='pending';
create index scheduled_posts_owner_idx
 on public.scheduled_posts(actor_id,scheduled_for desc);
alter table public.scheduled_posts enable row level security;

-- RLS AND database constraints protect scheduling against direct API clients.
create function public.validate_scheduled_post() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' or (tg_op='UPDATE' and
   (new.scheduled_for is distinct from old.scheduled_for or new.status='pending' and old.status='draft')) then
  if new.scheduled_for <= now()+interval '30 seconds'
   or new.scheduled_for > now()+interval '365 days' then
   raise exception 'Choose a future date at least thirty seconds away (maximum one year)';
  end if;
 end if;
 if (tg_op='INSERT' or new.media_path is distinct from old.media_path)
   and new.media_path is not null and (
   split_part(new.media_path,'/',1)<>auth.uid()::text
   or split_part(new.media_path,'/',2)<>new.id::text
 ) then
  -- Trusted publisher does not change media_path.
  raise exception 'Invalid scheduled media location';
 end if;
 return new;
end $$;
create trigger validate_scheduled_post before insert or update of scheduled_for,status,media_path
on public.scheduled_posts for each row execute function public.validate_scheduled_post();

create policy "Read own scheduled posts" on public.scheduled_posts
 for select to authenticated using (public.can_act_as(actor_id));
create policy "Create scheduled draft" on public.scheduled_posts
 for insert to authenticated with check (
   status='draft' and published_post_id is null
   and attempt_count=0 and retry_after is null and last_error is null
   and public.can_act_as(actor_id)
   and (repost_of_id is null or public.can_view_post(repost_of_id))
   and (community_id is null or public.is_mesh_member(community_id,actor_id))
   and (mission_id is null or public.is_mission_participant(mission_id,actor_id))
 );
create policy "Attach to own draft" on public.scheduled_posts
 for update to authenticated
 using (status='draft' and public.can_act_as(actor_id))
 with check (status='draft' and public.can_act_as(actor_id));
revoke all on public.scheduled_posts from public,anon,authenticated;
grant select,insert on public.scheduled_posts to authenticated;
grant update(media_path,media_type,updated_at) on public.scheduled_posts to authenticated;

-- Draft -> Pending is server-validated, preventing scheduled jobs from seeing
-- incomplete uploads. Retrying client requests is harmless after activation.
create function public.activate_scheduled_post(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_row public.scheduled_posts%rowtype;
begin
 select * into v_row from public.scheduled_posts where id=p_id for update;
 if not found or not public.can_act_as(v_row.actor_id) then raise exception 'Not permitted'; end if;
 if v_row.status='pending' then return true; end if;
 if v_row.status<>'draft' then raise exception 'Cannot activate this post'; end if;
 if v_row.scheduled_for<=now()+interval '30 seconds' then
   raise exception 'Scheduled time is too close; choose a later time';
 end if;
 update public.scheduled_posts set status='pending',updated_at=now() where id=p_id;
 return true;
end $$;

-- Editing and cancellation serialize against the same scheduled row lock as
-- publication. Clients cannot forge a published state or switch actors.
create function public.edit_scheduled_post(
 p_id uuid,p_body text,p_scheduled_for timestamptz,p_visibility text
) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_row public.scheduled_posts%rowtype;
begin
 select * into v_row from public.scheduled_posts where id=p_id for update;
 if not found or not public.can_act_as(v_row.actor_id) then raise exception 'Not permitted'; end if;
 if v_row.status<>'pending' then raise exception 'Post is no longer editable'; end if;
 if char_length(trim(coalesce(p_body,''))) not between 1 and 5000
  or p_visibility not in ('public','followers') then raise exception 'Invalid post'; end if;
 update public.scheduled_posts
 set body=trim(p_body), scheduled_for=p_scheduled_for,
     visibility=case when community_id is not null or mission_id is not null then 'public' else p_visibility end,
     retry_after=null,attempt_count=0,last_error=null,updated_at=now()
 where id=p_id;
 return true;
end $$;
create function public.cancel_scheduled_post(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_row public.scheduled_posts%rowtype;
begin
 select * into v_row from public.scheduled_posts where id=p_id for update;
 if not found or not public.can_act_as(v_row.actor_id) then raise exception 'Not permitted'; end if;
 if v_row.status in ('canceled','failed') then
   update public.scheduled_posts set status='canceled',updated_at=now() where id=p_id;
   return true;
 end if;
 if v_row.status not in ('draft','pending') then raise exception 'This post has already been published'; end if;
 update public.scheduled_posts set status='canceled',updated_at=now() where id=p_id;
 return true;
end $$;

-- A private scheduled attachment can only be downloaded by its scheduling owner.
-- After publication, existing post-media RLS (can_view_post) takes over.
create policy "Read own scheduled post media" on storage.objects
 for select to authenticated using (
  bucket_id='post-media'
  and exists (
   select 1 from public.scheduled_posts s
   where s.id::text=split_part(name,'/',2)
    and s.media_path=name
    and s.status in ('draft','pending','failed')
    and public.can_act_as(s.actor_id)
  )
 );

-- Called by the server's authenticated cron endpoint only. Locking, deterministic
-- post ids, and ON CONFLICT prevent duplicate posts on repeated cron invocations.
create function public.publish_due_scheduled_posts(p_limit integer default 25)
returns integer
language plpgsql security definer set search_path='' as $$
declare v_post public.scheduled_posts%rowtype; v_count integer:=0;
begin
 if current_user <> 'postgres' and auth.role() is distinct from 'service_role' then
   raise exception 'Not permitted';
 end if;
 for v_post in
   select * from public.scheduled_posts
   where status='pending' and scheduled_for<=now()
     and (retry_after is null or retry_after<=now())
   order by scheduled_for,id limit least(greatest(p_limit,1),50)
   for update skip locked
 loop
  begin
   if not exists (
    select 1 from public.actors a
     left join public.organizations o on o.id=a.organization_id
    where a.id=v_post.actor_id and (a.profile_id is not null or o.removed_at is null)
   ) or (v_post.community_id is not null and not exists (
     select 1 from public.mesh_communities c
     where c.id=v_post.community_id and c.removed_at is null
   )) or (v_post.community_id is not null and not public.is_mesh_member(v_post.community_id,v_post.actor_id))
    or (v_post.mission_id is not null and not exists (
     select 1 from public.missions m where m.id=v_post.mission_id and m.removed_at is null
   )) or (v_post.mission_id is not null and not public.is_mission_participant(v_post.mission_id,v_post.actor_id)) then
     update public.scheduled_posts set status='failed',last_error='Author or group permissions have changed',
       updated_at=now() where id=v_post.id;
     continue;
   end if;
   insert into public.posts
    (id,actor_id,body,visibility,repost_of_id,community_id,mission_id,media_path,media_type,created_at,updated_at)
   values
    (v_post.id,v_post.actor_id,v_post.body,v_post.visibility,v_post.repost_of_id,v_post.community_id,
     v_post.mission_id,v_post.media_path,v_post.media_type,now(),now())
   on conflict (id) do nothing;
   if not exists(select 1 from public.posts p where p.id=v_post.id and p.actor_id=v_post.actor_id)
   then raise exception 'Publication conflict'; end if;
   update public.scheduled_posts set status='published',published_post_id=v_post.id,
       last_error=null,retry_after=null,updated_at=now() where id=v_post.id;
   v_count:=v_count+1;
  exception when others then
   update public.scheduled_posts set attempt_count=attempt_count+1,
    status=case when attempt_count>=4 then 'failed' else 'pending' end,
    last_error=left(sqlerrm,240),retry_after=now()+interval '5 minutes',
    updated_at=now() where id=v_post.id;
  end;
 end loop;
 return v_count;
end $$;

revoke all on function public.activate_scheduled_post(uuid) from public,anon,authenticated;
revoke all on function public.edit_scheduled_post(uuid,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.cancel_scheduled_post(uuid) from public,anon,authenticated;
revoke all on function public.publish_due_scheduled_posts(integer) from public,anon,authenticated;
grant execute on function public.activate_scheduled_post(uuid) to authenticated;
grant execute on function public.edit_scheduled_post(uuid,text,timestamptz,text) to authenticated;
grant execute on function public.cancel_scheduled_post(uuid) to authenticated;
grant execute on function public.publish_due_scheduled_posts(integer) to service_role;

-- Activate a one-minute scheduler only after staging acceptance and confirming
-- the Vercel plan supports minute-level cron. No pg_cron installed here.
