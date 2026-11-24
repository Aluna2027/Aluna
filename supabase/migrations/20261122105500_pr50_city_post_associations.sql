begin;

-- City Hub associations point to the same post row used by the Global Feed.
alter table public.posts
  add column city_id uuid references public.places(id) on delete set null,
  add column city_hashtag_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(city_hashtag_refs) = 'array');
alter table public.scheduled_posts
  add column city_id uuid references public.places(id) on delete set null,
  add column city_hashtag_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(city_hashtag_refs) = 'array');
create index posts_city_feed_idx on public.posts(city_id,created_at desc,id desc) where city_id is not null;

create table public.post_city_hashtag_refs (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 64),
  city_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null,
  primary key(post_id,tag)
);
create index post_city_hashtag_refs_city_feed_idx on public.post_city_hashtag_refs(city_id,created_at desc,post_id desc);
alter table public.post_city_hashtag_refs enable row level security;
revoke all on public.post_city_hashtag_refs from public,anon,authenticated;
grant select on public.post_city_hashtag_refs to authenticated;
create policy "Read city hashtag references of visible posts"
  on public.post_city_hashtag_refs for select to authenticated using (public.can_view_post(post_id));

create function public.pr50_city_key(p_value text) returns text
language sql immutable strict set search_path = '' as $fn$
  select regexp_replace(lower(normalize(p_value,NFKD) collate "C"),'[^a-z0-9]','','g')
$fn$;

create function public.pr50_validate_city_associations() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare item jsonb; city public.places%rowtype; canonical_tag text; tag_city uuid; seen_tags text[]:=array[]::text[];
begin
  if jsonb_typeof(new.city_hashtag_refs) is distinct from 'array'
     or jsonb_array_length(new.city_hashtag_refs)>10 then raise exception 'Invalid city hashtag associations'; end if;
  if new.city_id is not null and not exists(select 1 from public.places p where p.id=new.city_id and p.source_key is not null) then
    raise exception 'City Hub requires a seeded city';
  end if;
  for item in select value from jsonb_array_elements(new.city_hashtag_refs) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item->'tag') is distinct from 'string'
       or jsonb_typeof(item->'cityId') is distinct from 'string'
       or (item->>'tag') !~ '^[[:alnum:]_]{1,64}$' then raise exception 'Invalid city hashtag reference'; end if;
    canonical_tag:=lower(normalize(item->>'tag',NFKC));
    if canonical_tag=any(seen_tags) then raise exception 'Duplicate city hashtag reference'; end if;
    seen_tags:=array_append(seen_tags,canonical_tag);
    tag_city:=(item->>'cityId')::uuid;
    if not (new.body ~* ('(^|[^[:alnum:]_])#'||canonical_tag||'([^[:alnum:]_]|$)')) then
      raise exception 'City hashtag is not present in post text';
    end if;
    select * into city from public.places p where p.id=tag_city and p.source_key is not null;
    if not found or public.pr50_city_key(city.name)<>public.pr50_city_key(canonical_tag) then
      raise exception 'City does not match hashtag';
    end if;
  end loop;
  return new;
end
$fn$;
revoke all on function public.pr50_city_key(text),public.pr50_validate_city_associations() from public,anon,authenticated;
create trigger pr50_validate_post_city_associations before insert or update of body,city_id,city_hashtag_refs on public.posts
  for each row execute function public.pr50_validate_city_associations();
create trigger pr50_validate_scheduled_city_associations before insert or update of body,city_id,city_hashtag_refs on public.scheduled_posts
  for each row execute function public.pr50_validate_city_associations();

create function public.pr50_sync_city_hashtag_refs() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare item jsonb;
begin
  delete from public.post_city_hashtag_refs where post_id=new.id;
  for item in select value from jsonb_array_elements(new.city_hashtag_refs) loop
    insert into public.post_city_hashtag_refs(post_id,tag,city_id,created_at)
    values(new.id,lower(normalize(item->>'tag',NFKC)),(item->>'cityId')::uuid,new.created_at)
    on conflict(post_id,tag) do update set city_id=excluded.city_id,created_at=excluded.created_at;
  end loop;
  return new;
end
$fn$;
revoke all on function public.pr50_sync_city_hashtag_refs() from public,anon,authenticated;
create trigger pr50_sync_city_hashtag_refs after insert or update of body,city_hashtag_refs on public.posts
  for each row execute function public.pr50_sync_city_hashtag_refs();

create function public.city_feed_page(p_city uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns table(id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,author_name text,author_kind text,reaction_count bigint,comment_count bigint,media_path text,media_type text)
language sql stable security invoker set search_path = '' as $fn$
  select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,
    coalesce(pr.display_name,o.name,'Member'),case when a.profile_id is not null then 'user' else o.organization_type::text end,
    (select count(*) from public.reactions r where r.post_id=p.id),
    (select count(*) from public.comments c where c.post_id=p.id),p.media_path,p.media_type
  from public.posts p join public.actors a on a.id=p.actor_id
  left join public.public_profiles pr on pr.id=a.profile_id left join public.organizations o on o.id=a.organization_id
  where (p.city_id=p_city or exists(select 1 from public.post_city_hashtag_refs refs where refs.post_id=p.id and refs.city_id=p_city))
    and (p_before is null or (p_before_id is null and p.created_at<p_before) or (p.created_at,p.id)<(p_before,p_before_id))
  order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50)
$fn$;
revoke all on function public.city_feed_page(uuid,timestamptz,uuid,integer) from public,anon;
grant execute on function public.city_feed_page(uuid,timestamptz,uuid,integer) to authenticated;

-- Keep selected city disambiguation attached to scheduled rows through edits.
create or replace function public.edit_scheduled_post(
  p_id uuid,p_body text,p_scheduled_for timestamptz,p_visibility text,
  p_mention_refs jsonb,p_city_hashtag_refs jsonb
) returns boolean language plpgsql security definer set search_path = '' as $fn$
declare r public.scheduled_posts%rowtype;
begin
  select * into r from public.scheduled_posts where id=p_id for update;
  if not found or not public.can_act_as(r.actor_id) then raise exception 'Not permitted'; end if;
  if r.status<>'pending' then raise exception 'Post is no longer editable'; end if;
  if p_body is null or char_length(trim(p_body))>5000 or (char_length(trim(p_body))=0 and (r.media_path is null or r.media_type not in ('image','video'))) then raise exception 'Invalid post'; end if;
  if r.community_id is not null or r.mission_id is not null then
    if p_visibility not in ('public','members') then raise exception 'Invalid audience'; end if;
    if r.visibility='members' and p_visibility<>'members' then raise exception 'Members-only audience cannot be expanded'; end if;
    if p_visibility='members' and ((r.community_id is not null and not public.is_mesh_member(r.community_id,r.actor_id)) or (r.mission_id is not null and not public.is_mission_participant(r.mission_id,r.actor_id))) then raise exception 'Membership required'; end if;
  elsif p_visibility not in ('public','followers') then raise exception 'Invalid audience'; end if;
  update public.scheduled_posts set body=trim(p_body),mention_refs=coalesce(p_mention_refs,'[]'::jsonb),city_hashtag_refs=coalesce(p_city_hashtag_refs,'[]'::jsonb),scheduled_for=p_scheduled_for,visibility=p_visibility,retry_after=null,attempt_count=0,last_error=null,updated_at=now() where id=p_id;
  return true;
end
$fn$;
create or replace function public.edit_scheduled_post(p_id uuid,p_body text,p_scheduled_for timestamptz,p_visibility text,p_mention_refs jsonb)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare r public.scheduled_posts%rowtype;
begin
  select * into r from public.scheduled_posts where id=p_id for update;
  if not found or not public.can_act_as(r.actor_id) then raise exception 'Not permitted'; end if;
  return public.edit_scheduled_post(p_id,p_body,p_scheduled_for,p_visibility,p_mention_refs,case when trim(p_body)=r.body then r.city_hashtag_refs else '[]'::jsonb end);
end
$fn$;
create or replace function public.edit_scheduled_post(p_id uuid,p_body text,p_scheduled_for timestamptz,p_visibility text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare r public.scheduled_posts%rowtype;
begin
  select * into r from public.scheduled_posts where id=p_id for update;
  if not found or not public.can_act_as(r.actor_id) then raise exception 'Not permitted'; end if;
  return public.edit_scheduled_post(p_id,p_body,p_scheduled_for,p_visibility,case when trim(p_body)=r.body then r.mention_refs else '[]'::jsonb end,case when trim(p_body)=r.body then r.city_hashtag_refs else '[]'::jsonb end);
end
$fn$;
revoke all on function public.edit_scheduled_post(uuid,text,timestamptz,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.edit_scheduled_post(uuid,text,timestamptz,text,jsonb,jsonb) to authenticated;

-- Preserve scheduling context in the service-role publication transition.
create or replace function public.publish_due_scheduled_posts(p_limit integer default 25)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_post public.scheduled_posts%rowtype; v_count integer := 0;
begin
  if current_user <> 'postgres' and auth.role() is distinct from 'service_role' then raise exception 'Not permitted'; end if;
  for v_post in select * from public.scheduled_posts where status='pending' and scheduled_for<=now()
    and (retry_after is null or retry_after<=now()) order by scheduled_for,id
    limit least(greatest(p_limit,1),50) for update skip locked
  loop
    begin
      if not exists(select 1 from public.actors actor left join public.organizations organization on organization.id=actor.organization_id
        where actor.id=v_post.actor_id and (actor.profile_id is not null or organization.removed_at is null))
        or (v_post.community_id is not null and (not exists(select 1 from public.mesh_communities c where c.id=v_post.community_id and c.removed_at is null) or not public.is_mesh_member(v_post.community_id,v_post.actor_id)))
        or (v_post.mission_id is not null and (not exists(select 1 from public.missions m where m.id=v_post.mission_id and m.removed_at is null) or not public.is_mission_participant(v_post.mission_id,v_post.actor_id))) then
        update public.scheduled_posts set status='failed',last_error='Author or group permissions have changed',updated_at=now() where id=v_post.id; continue;
      end if;
      insert into public.posts(id,actor_id,body,visibility,repost_of_id,community_id,mission_id,media_path,media_type,mention_refs,city_id,city_hashtag_refs,created_at,updated_at)
      values(v_post.id,v_post.actor_id,v_post.body,v_post.visibility,v_post.repost_of_id,v_post.community_id,v_post.mission_id,v_post.media_path,v_post.media_type,v_post.mention_refs,v_post.city_id,v_post.city_hashtag_refs,now(),now())
      on conflict(id) do nothing;
      if not exists(select 1 from public.posts p where p.id=v_post.id and p.actor_id=v_post.actor_id) then raise exception 'Publication conflict'; end if;
      update public.scheduled_posts set status='published',published_post_id=v_post.id,last_error=null,retry_after=null,updated_at=now() where id=v_post.id;
      v_count:=v_count+1;
    exception when others then
      update public.scheduled_posts set attempt_count=attempt_count+1,status=case when attempt_count>=4 then 'failed' else 'pending' end,last_error=left(sqlerrm,240),retry_after=now()+interval '5 minutes',updated_at=now() where id=v_post.id;
    end;
  end loop;
  return v_count;
end
$fn$;
revoke all on function public.publish_due_scheduled_posts(integer) from public,anon,authenticated;
grant execute on function public.publish_due_scheduled_posts(integer) to service_role;

commit;
