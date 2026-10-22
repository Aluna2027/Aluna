-- PR33: membership helper RPCs are used by authenticated RLS policies.
-- Supabase default privileges can grant EXECUTE directly to anon; revoking PUBLIC
-- alone does not remove that direct role grant. Preserve signed-in policy access.
revoke execute on function public.is_mesh_member(uuid,uuid) from public, anon;
revoke execute on function public.is_mission_participant(uuid,uuid) from public, anon;
grant execute on function public.is_mesh_member(uuid,uuid) to authenticated;
grant execute on function public.is_mission_participant(uuid,uuid) to authenticated;
