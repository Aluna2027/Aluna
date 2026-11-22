-- INSERT RETURNING evaluates SELECT RLS against the new row. A STABLE lookup
-- of posts by id cannot see that row in the statement snapshot.
begin;
create function public.pr47_can_view_post_fields(p_visibility text,p_actor uuid,p_community uuid,p_mission uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select p_visibility='public'
 or (p_visibility='followers' and (public.can_act_as(p_actor) or exists(
   select 1 from public.follows f where f.followed_actor_id=p_actor and public.can_act_as(f.follower_actor_id))))
 or (p_visibility='members' and (
   (p_community is not null and exists(select 1 from public.mesh_community_members m
    where m.community_id=p_community and public.can_act_as(m.actor_id)))
   or (p_mission is not null and exists(select 1 from public.actors a
    where public.can_act_as(a.id) and public.is_mission_participant(p_mission,a.id)))))
$fn$;
revoke all on function public.pr47_can_view_post_fields(text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.pr47_can_view_post_fields(text,uuid,uuid,uuid) to authenticated;

drop policy "Read visible posts" on public.posts;
create policy "Read visible posts" on public.posts for select to authenticated using (
 public.pr47_can_view_post_fields(visibility,actor_id,community_id,mission_id));

-- Existing callers (comments, reactions, annotations and Storage) share the
-- same membership rule. Their target post already exists.
create or replace function public.can_view_post(p_post uuid) returns boolean
language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.posts p where p.id=p_post
  and public.pr47_can_view_post_fields(p.visibility,p.actor_id,p.community_id,p.mission_id))
$fn$;
commit;
