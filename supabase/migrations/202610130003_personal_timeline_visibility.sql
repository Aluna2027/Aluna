-- Public Global Feed; Personal Timeline = owned actors + followed actors.
-- Keep posts RLS as an additional, mandatory visibility check.
-- Fresh bootstrap: the earlier feed_page returns 10 columns; this version returns 12.
-- PostgreSQL requires dropping the old function before changing its return type.
drop function if exists public.feed_page(boolean,timestamptz,uuid,integer);

create or replace function public.feed_page(
 p_following boolean default false,
 p_before timestamptz default null,
 p_before_id uuid default null,
 p_limit integer default 20
)
returns table(
 id uuid,actor_id uuid,body text,visibility text,repost_of_id uuid,created_at timestamptz,
 author_name text,author_kind text,reaction_count bigint,comment_count bigint,
 media_path text,media_type text
)
language sql stable set search_path = ''
as $function$
 select p.id,p.actor_id,p.body,p.visibility,p.repost_of_id,p.created_at,
  coalesce(pr.display_name,o.name,'Member'),
  case when a.profile_id is not null then 'user' else o.organization_type::text end,
  (select count(*) from public.reactions r where r.post_id=p.id),
  (select count(*) from public.comments c where c.post_id=p.id),
  p.media_path,p.media_type
 from public.posts p
 join public.actors a on a.id=p.actor_id
 left join public.profiles pr on pr.id=a.profile_id
 left join public.organizations o on o.id=a.organization_id
 where (p_before is null
  or (p_before_id is null and p.created_at < p_before)
  or (p.created_at,p.id) < (p_before,p_before_id))
  and (
   (not p_following and p.visibility='public')
   or
   (p_following and (
     public.can_act_as(p.actor_id)
     or exists(
       select 1 from public.follows f
       where f.followed_actor_id=p.actor_id
         and public.can_act_as(f.follower_actor_id)
     )
   ))
  )
 order by p.created_at desc,p.id desc
 limit least(greatest(p_limit,1),50)
$function$;

-- Preserve the original function access policy after replacing its signature.
revoke all on function public.feed_page(boolean,timestamptz,uuid,integer) from public;
grant execute on function public.feed_page(boolean,timestamptz,uuid,integer) to authenticated;
