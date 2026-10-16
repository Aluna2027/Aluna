-- PR #25A: photo/video-only posts, including scheduled media.
-- Keep text-only and document-only posts from being empty.
alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_body_check check (
  char_length(trim(body)) <= 5000
  and (char_length(trim(body)) >= 1
    or (media_path is not null and media_type in ('image','video')))
);
-- An empty scheduled draft is private and not publishable until media is linked.
alter table public.scheduled_posts drop constraint scheduled_posts_body_check;
alter table public.scheduled_posts add constraint scheduled_posts_body_check check (
  char_length(trim(body)) <= 5000
  and (char_length(trim(body)) >= 1
    or status in ('draft','canceled')
    or (media_path is not null and media_type in ('image','video')))
);
create or replace function public.activate_scheduled_post(p_id uuid) returns boolean
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
 if char_length(trim(v_row.body))=0
   and (v_row.media_path is null or v_row.media_type not in ('image','video')) then
   raise exception 'Post needs text or an attached photo or video';
 end if;
 update public.scheduled_posts set status='pending',updated_at=now() where id=p_id;
 return true;
end $$;
create or replace function public.edit_scheduled_post(
 p_id uuid,p_body text,p_scheduled_for timestamptz,p_visibility text
) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_row public.scheduled_posts%rowtype;
begin
 select * into v_row from public.scheduled_posts where id=p_id for update;
 if not found or not public.can_act_as(v_row.actor_id) then raise exception 'Not permitted'; end if;
 if v_row.status<>'pending' then raise exception 'Post is no longer editable'; end if;
 if p_body is null or char_length(trim(p_body))>5000
  or (char_length(trim(p_body))=0
    and (v_row.media_path is null or v_row.media_type not in ('image','video')))
  or p_visibility not in ('public','followers') then raise exception 'Invalid post'; end if;
 update public.scheduled_posts
 set body=trim(p_body), scheduled_for=p_scheduled_for,
     visibility=case when community_id is not null or mission_id is not null then 'public' else p_visibility end,
     retry_after=null,attempt_count=0,last_error=null,updated_at=now()
 where id=p_id;
 return true;
end $$;
