-- PR #47 follow-up: atomic comment editing and one vote per authenticated person.
-- PREPARED ONLY. Do not apply to Demo or Production without separate owner approval.
begin;

alter table public.comments add column if not exists edited_at timestamptz;

create table public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, voter_id)
);
create index comment_votes_comment_idx on public.comment_votes(comment_id, vote);
alter table public.comment_votes enable row level security;
revoke all on public.comment_votes from public, anon, authenticated;
-- Voting is performed through the checked RPC. Rows are not directly exposed.

create function public.pr47_edit_comment(p_comment_id uuid, p_body text, p_mentions jsonb default '[]'::jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare existing record; clean_body text;
begin
  if auth.uid() is null then return false; end if;
  clean_body := btrim(p_body);
  if clean_body is null or char_length(clean_body) not between 1 and 2000
     or jsonb_typeof(p_mentions) is distinct from 'array'
     or jsonb_array_length(p_mentions)>30 then return false; end if;
  select id,actor_id,post_id into existing from public.comments where id=p_comment_id for update;
  if not found or not public.can_act_as(existing.actor_id)
     or not public.can_view_post(existing.post_id) then return false; end if;
  -- The existing BEFORE UPDATE trigger validates every stable mention reference.
  update public.comments set body=clean_body, mention_refs=p_mentions, edited_at=now()
    where id=p_comment_id;
  -- The INSERT-only comment trigger does not run for edits. Replace derived references
  -- atomically; editing never sends new mention notifications.
  delete from public.comment_mentions where comment_id=p_comment_id;
  insert into public.comment_mentions(comment_id,actor_id,start_offset,label)
    select p_comment_id,(item->>'actorId')::uuid,(item->>'start')::integer,item->>'label'
    from jsonb_array_elements(p_mentions) item;
  -- Retain notifications for unchanged mentions, drop only obsolete recipients; never issue new ones.
  delete from public.notifications n where n.kind='comment_mention' and n.target_id=p_comment_id
    and not exists (select 1 from public.comment_mentions cm
      where cm.comment_id=p_comment_id and cm.actor_id=n.recipient_actor_id);
  return true;
end $$;
revoke all on function public.pr47_edit_comment(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.pr47_edit_comment(uuid,text,jsonb) to authenticated;

create function public.pr47_vote_comment(p_comment_id uuid,p_vote smallint)
returns table(upvotes bigint,downvotes bigint,my_vote smallint)
language plpgsql security definer set search_path='' as $$
declare parent_post uuid; prior_vote smallint;
begin
  if auth.uid() is null or p_vote not in (-1,1) then raise exception 'Vote not authorized'; end if;
  select post_id into parent_post from public.comments where id=p_comment_id;
  if not found or not public.can_view_post(parent_post) then raise exception 'Vote not authorized'; end if;
  -- Advisory transaction lock per comment/voter prevents concurrent toggles from racing.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_comment_id::text||auth.uid()::text,0));
  select v.vote into prior_vote from public.comment_votes v
     where v.comment_id=p_comment_id and v.voter_id=auth.uid();
  if prior_vote=p_vote then
    delete from public.comment_votes where comment_id=p_comment_id and voter_id=auth.uid();
  else
    insert into public.comment_votes(comment_id,voter_id,vote)
       values(p_comment_id,auth.uid(),p_vote)
       on conflict(comment_id,voter_id) do update set vote=excluded.vote;
  end if;
  return query select
    count(*) filter(where v.vote=1),
    count(*) filter(where v.vote=-1),
    coalesce(max(v.vote) filter(where v.voter_id=auth.uid()),0)::smallint
    from public.comment_votes v where v.comment_id=p_comment_id;
end $$;
revoke all on function public.pr47_vote_comment(uuid,smallint) from public,anon,authenticated;
grant execute on function public.pr47_vote_comment(uuid,smallint) to authenticated;

create function public.pr47_comment_vote_summary(p_comment_ids uuid[])
returns table(comment_id uuid,upvotes bigint,downvotes bigint,my_vote smallint)
language sql stable security definer set search_path='' as $$
  select c.id,
    count(v.vote) filter(where v.vote=1),
    count(v.vote) filter(where v.vote=-1),
    coalesce(max(v.vote) filter(where v.voter_id=auth.uid()),0)::smallint
  from public.comments c left join public.comment_votes v on v.comment_id=c.id
  where auth.uid() is not null and c.id=any(p_comment_ids) and public.can_view_post(c.post_id)
  group by c.id
$$;
revoke all on function public.pr47_comment_vote_summary(uuid[]) from public,anon,authenticated;
grant execute on function public.pr47_comment_vote_summary(uuid[]) to authenticated;

commit;
