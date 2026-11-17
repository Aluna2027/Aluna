begin;

alter table public.posts
  add column mention_refs jsonb not null default '[]'::jsonb
  check (jsonb_typeof(mention_refs) = 'array');
alter table public.scheduled_posts
  add column mention_refs jsonb not null default '[]'::jsonb
  check (jsonb_typeof(mention_refs) = 'array');
grant update (mention_refs) on public.posts to authenticated;

create table public.post_mentions (
  post_id uuid not null references public.posts(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  start_offset integer not null check (start_offset >= 0),
  label text not null check (char_length(label) between 1 and 150),
  primary key (post_id, start_offset)
);
create index post_mentions_actor_idx on public.post_mentions(actor_id, post_id);

create table public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 64),
  created_at timestamptz not null,
  primary key (post_id, tag)
);
create index post_hashtags_lookup_idx on public.post_hashtags(tag, created_at desc, post_id desc);

-- Backfill only the derived hashtag index so existing posts remain searchable.
insert into public.post_hashtags(post_id, tag, created_at)
select post.id, lower(normalize(matches.parts[2], NFKC)), post.created_at
  from public.posts post
 cross join lateral regexp_matches(post.body, '(^|[^[:alnum:]_])#([[:alnum:]_]+)', 'g') as matches(parts)
 where char_length(lower(normalize(matches.parts[2], NFKC))) between 1 and 64
on conflict (post_id, tag) do nothing;

alter table public.post_mentions enable row level security;
alter table public.post_hashtags enable row level security;
revoke all on public.post_mentions, public.post_hashtags from public, anon, authenticated;
grant select on public.post_mentions, public.post_hashtags to authenticated;

create policy "Read mentions of visible posts" on public.post_mentions
  for select to authenticated using (public.can_view_post(post_id));
create policy "Read hashtags of visible posts" on public.post_hashtags
  for select to authenticated using (public.can_view_post(post_id));

-- One actor receives at most one notification for a particular mentioned post.
create unique index notifications_one_mention_per_actor_post
  on public.notifications(recipient_actor_id, target_id)
  where kind = 'mention' and target_id is not null;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow','connection','comment','reaction','message','membership','mention'));

create function public.pr47_validate_mention_refs() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare
  item jsonb;
  actor_uuid uuid;
  current_label text;
  target_active boolean;
  label_text text;
  pos integer;
  last_end integer := 0;
  was_existing boolean;
begin
  if jsonb_typeof(new.mention_refs) is distinct from 'array' then
    raise exception 'Mention references must be an array';
  end if;
  if jsonb_array_length(new.mention_refs) > 30 then
    raise exception 'Too many mentions';
  end if;

  for item in select value from jsonb_array_elements(new.mention_refs) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item->'actorId') is distinct from 'string'
       or jsonb_typeof(item->'start') is distinct from 'number'
       or jsonb_typeof(item->'label') is distinct from 'string'
       or (item->>'start') !~ '^[0-9]{1,7}$' then
      raise exception 'Invalid mention reference';
    end if;

    pos := (item->>'start')::integer;
    actor_uuid := (item->>'actorId')::uuid;
    label_text := item->>'label';
    if pos < last_end or pos + char_length(label_text) + 1 > char_length(new.body)
       or char_length(label_text) not between 1 and 150
       or substring(new.body from pos + 1 for char_length(label_text) + 1)
            is distinct from '@' || label_text then
      raise exception 'Mention position does not match post text';
    end if;
    if pos > 0 and substring(new.body from pos for 1) ~ '^[[:alnum:]_]$' then
      raise exception 'Invalid mention word boundary';
    end if;
    last_end := pos + char_length(label_text) + 1;

    was_existing := false;
    if tg_op = 'UPDATE' then
      select exists (
        select 1 from jsonb_array_elements(old.mention_refs) prior
         -- Text edits may shift an already validated reference after a rename.
         -- Actor and historical label remain stable; new positions were checked above.
         where prior->>'actorId' = item->>'actorId'
           and prior->>'label' = item->>'label'
      ) into was_existing;
    elsif tg_op = 'INSERT' then
      select exists (
        select 1 from public.scheduled_posts scheduled
         where scheduled.id = new.id and scheduled.actor_id = new.actor_id
           and scheduled.status = 'pending'
           and scheduled.mention_refs @> jsonb_build_array(item)
      ) into was_existing;
    end if;

    select coalesce(profile.display_name, organization.name),
           coalesce(organization.removed_at is null, profile.id is not null)
      into current_label, target_active
      from public.actors actor
      left join public.profiles profile on profile.id = actor.profile_id
      left join public.organizations organization on organization.id = actor.organization_id
     where actor.id = actor_uuid;
    if (not found or current_label is null) and not was_existing then
      raise exception 'Mention target not found';
    end if;
    if was_existing is false and (current_label is distinct from label_text or not target_active) then
      raise exception 'Mention must match an active account name';
    end if;
  end loop;
  return new;
end
$fn$;

create trigger pr47_validate_post_mentions
  before insert or update of body, mention_refs on public.posts
  for each row execute function public.pr47_validate_mention_refs();
create trigger pr47_validate_scheduled_mentions
  before insert or update of body, mention_refs on public.scheduled_posts
  for each row execute function public.pr47_validate_mention_refs();

create function public.pr47_sync_post_annotations() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare
  item jsonb;
  recipient uuid;
  token text[];
  recipient_can_view boolean;
  newly_mentioned boolean;
begin
  delete from public.post_mentions where post_id = new.id;
  delete from public.post_hashtags where post_id = new.id;

  for item in select value from jsonb_array_elements(new.mention_refs) loop
    recipient := (item->>'actorId')::uuid;
    if exists (select 1 from public.actors where id = recipient) then
      insert into public.post_mentions(post_id, actor_id, start_offset, label)
      values (new.id, recipient, (item->>'start')::integer, item->>'label');

    recipient_can_view := new.visibility = 'public' or recipient = new.actor_id
      or exists (
        select 1 from public.actors mentioned
        join public.follows follow on follow.followed_actor_id = new.actor_id
          and follow.follower_actor_id = mentioned.id
        where mentioned.id = recipient and mentioned.profile_id is not null
      )
      or exists (
        select 1
          from public.actors mentioned
          join public.organizations organization on organization.id = mentioned.organization_id
            and organization.removed_at is null
         where mentioned.id = recipient
           and (
             exists (select 1 from public.follows follow
                      where follow.follower_actor_id = mentioned.id
                        and follow.followed_actor_id = new.actor_id)
             or (
               exists (select 1 from public.organization_members membership
                        where membership.organization_id = organization.id
                          and membership.member_role = 'admin')
               and not exists (
                 select 1
                   from public.organization_members membership
                   left join public.actors admin_actor on admin_actor.profile_id = membership.profile_id
                  where membership.organization_id = organization.id
                    and membership.member_role = 'admin'
                    and (admin_actor.id is null or not exists (
                      select 1 from public.follows follow
                       where follow.follower_actor_id = admin_actor.id
                         and follow.followed_actor_id = new.actor_id
                    ))
               )
             )
           )
      );

    if tg_op = 'INSERT' then
      newly_mentioned := true;
    else
      select not exists (
        select 1 from jsonb_array_elements(old.mention_refs) prior
         where prior->>'actorId' = item->>'actorId'
      ) into newly_mentioned;
    end if;

      if recipient <> new.actor_id and recipient_can_view and newly_mentioned then
        insert into public.notifications(recipient_actor_id, sender_actor_id, kind, target_id)
        values (recipient, new.actor_id, 'mention', new.id)
        on conflict (recipient_actor_id, target_id)
          where kind = 'mention' and target_id is not null do nothing;
      end if;
    end if;
  end loop;

  for token in select regexp_matches(new.body, '(^|[^[:alnum:]_])#([[:alnum:]_]+)', 'g') loop
    if char_length(lower(normalize(token[2], NFKC))) between 1 and 64 then
      insert into public.post_hashtags(post_id, tag, created_at)
      values (new.id, lower(normalize(token[2], NFKC)), new.created_at)
      on conflict (post_id, tag) do nothing;
    end if;
  end loop;
  return new;
end
$fn$;

create trigger pr47_sync_post_annotations
  after insert or update of body, mention_refs on public.posts
  for each row execute function public.pr47_sync_post_annotations();

create function public.pr47_cleanup_post_mentions() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  delete from public.notifications where kind = 'mention' and target_id = old.id;
  return old;
end
$fn$;
create trigger pr47_cleanup_post_mentions
  after delete on public.posts for each row execute function public.pr47_cleanup_post_mentions();

-- Keep the existing scheduler's locking, ownership, status and retry rules.
-- Only the validated annotation payload is added to the publish transition.
-- Retain the original signature for existing PostgREST callers.
create function public.edit_scheduled_post(
  p_id uuid, p_body text, p_scheduled_for timestamptz, p_visibility text,
  p_mention_refs jsonb
) returns boolean
language plpgsql security definer set search_path = '' as $fn$
declare v_row public.scheduled_posts%rowtype;
begin
  select * into v_row from public.scheduled_posts where id = p_id for update;
  if not found or not public.can_act_as(v_row.actor_id) then raise exception 'Not permitted'; end if;
  if v_row.status <> 'pending' then raise exception 'Post is no longer editable'; end if;
  if p_body is null or char_length(trim(p_body)) > 5000
     or (char_length(trim(p_body)) = 0 and (v_row.media_path is null or v_row.media_type not in ('image','video')))
     or p_visibility not in ('public', 'followers') then raise exception 'Invalid post'; end if;
  update public.scheduled_posts
     set body = trim(p_body), mention_refs = coalesce(p_mention_refs, '[]'::jsonb),
         scheduled_for = p_scheduled_for,
         visibility = case when community_id is not null or mission_id is not null then 'public' else p_visibility end,
         retry_after = null, attempt_count = 0, last_error = null, updated_at = now()
   where id = p_id;
  return true;
end
$fn$;

-- Legacy callers preserve references when the text is unchanged.
-- Changed text clears references rather than retaining stale offsets.
create or replace function public.edit_scheduled_post(
  p_id uuid, p_body text, p_scheduled_for timestamptz, p_visibility text
) returns boolean
language plpgsql security definer set search_path = '' as $fn$
declare v_row public.scheduled_posts%rowtype;
begin
  select * into v_row from public.scheduled_posts where id = p_id for update;
  if not found or not public.can_act_as(v_row.actor_id) then raise exception 'Not permitted'; end if;
  return public.edit_scheduled_post(p_id, p_body, p_scheduled_for, p_visibility,
    case when trim(p_body) = v_row.body then v_row.mention_refs else '[]'::jsonb end);
end
$fn$;
revoke all on function public.edit_scheduled_post(uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.edit_scheduled_post(uuid, text, timestamptz, text) to authenticated;

create or replace function public.publish_due_scheduled_posts(p_limit integer default 25)
returns integer
language plpgsql security definer set search_path = '' as $fn$
declare v_post public.scheduled_posts%rowtype; v_count integer := 0;
begin
  if current_user <> 'postgres' and auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted';
  end if;
  for v_post in
    select * from public.scheduled_posts
     where status = 'pending' and scheduled_for <= now()
       and (retry_after is null or retry_after <= now())
     order by scheduled_for, id
     limit least(greatest(p_limit, 1), 50)
     for update skip locked
  loop
    begin
      if not exists (
        select 1 from public.actors actor
        left join public.organizations organization on organization.id = actor.organization_id
         where actor.id = v_post.actor_id
           and (actor.profile_id is not null or organization.removed_at is null)
      ) or (v_post.community_id is not null and not exists (
        select 1 from public.mesh_communities community
         where community.id = v_post.community_id and community.removed_at is null
      )) or (v_post.community_id is not null and not public.is_mesh_member(v_post.community_id, v_post.actor_id))
        or (v_post.mission_id is not null and not exists (
          select 1 from public.missions mission
           where mission.id = v_post.mission_id and mission.removed_at is null
        )) or (v_post.mission_id is not null and not public.is_mission_participant(v_post.mission_id, v_post.actor_id)) then
        update public.scheduled_posts
           set status = 'failed', last_error = 'Author or group permissions have changed', updated_at = now()
         where id = v_post.id;
        continue;
      end if;
      insert into public.posts
        (id, actor_id, body, visibility, repost_of_id, community_id, mission_id,
         media_path, media_type, mention_refs, created_at, updated_at)
      values
        (v_post.id, v_post.actor_id, v_post.body, v_post.visibility, v_post.repost_of_id,
         v_post.community_id, v_post.mission_id, v_post.media_path, v_post.media_type,
         v_post.mention_refs, now(), now())
      on conflict (id) do nothing;
      if not exists (select 1 from public.posts post where post.id = v_post.id and post.actor_id = v_post.actor_id) then
        raise exception 'Publication conflict';
      end if;
      update public.scheduled_posts
         set status = 'published', published_post_id = v_post.id,
             last_error = null, retry_after = null, updated_at = now()
       where id = v_post.id;
      v_count := v_count + 1;
    exception when others then
      update public.scheduled_posts
         set attempt_count = attempt_count + 1,
             status = case when attempt_count >= 4 then 'failed' else 'pending' end,
             last_error = left(sqlerrm, 240), retry_after = now() + interval '5 minutes', updated_at = now()
       where id = v_post.id;
    end;
  end loop;
  return v_count;
end
$fn$;

revoke all on function public.pr47_validate_mention_refs() from public, anon, authenticated;
revoke all on function public.pr47_sync_post_annotations() from public, anon, authenticated;
revoke all on function public.pr47_cleanup_post_mentions() from public, anon, authenticated;
revoke all on function public.edit_scheduled_post(uuid, text, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.edit_scheduled_post(uuid, text, timestamptz, text, jsonb) to authenticated;
revoke all on function public.publish_due_scheduled_posts(integer) from public, anon, authenticated;
grant execute on function public.publish_due_scheduled_posts(integer) to service_role;

commit;
