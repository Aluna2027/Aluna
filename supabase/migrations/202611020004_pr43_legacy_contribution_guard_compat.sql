-- PR #43 regression fix: retain legacy Contribution place guard behavior.
-- Existing Contributions (submission_id NULL) may link a mission with an unrelated
-- but same-city community if the mission does not explicitly specify a community.
-- New PR43 submissions (submission_id set) still require an exact mission/community link.
-- Restore the original restriction to Aluna-recognized cities (source_key present).
-- No existing rows are modified. All PR43 completion/ownership checks stay intact.
create or replace function public.pr43_guard_contribution()
returns trigger language plpgsql security definer set search_path='' as $$
declare m public.missions%rowtype; c public.mesh_communities%rowtype;
begin
 if new.submission_id is not null and new.mission_id is null and new.community_id is null then raise exception 'A mission or community is required'; end if;
 if new.mission_id is not null then
  select * into m from public.missions where id=new.mission_id and removed_at is null;
  if not found then raise exception 'Mission unavailable'; end if;
 end if;
 if new.community_id is not null then
  select * into c from public.mesh_communities where id=new.community_id and removed_at is null;
  if not found then raise exception 'Community unavailable'; end if;
 end if;
 if new.mission_id is not null and new.community_id is not null then
  if (m.community_id is not null and m.community_id <> c.id)
     or (new.submission_id is not null and m.community_id is null) then
    raise exception 'Mission must be linked to selected community';
  end if;
 end if;
 if new.mission_id is not null and new.community_id is not null and m.city_id is distinct from c.city_id then
  raise exception 'Project cities must match';
 end if;
 if new.city_id is not null and (new.mission_id is not null and m.city_id is not null and new.city_id<>m.city_id or new.community_id is not null and new.city_id<>c.city_id) then
  raise exception 'City mismatch';
 end if;
 new.city_id:=coalesce(new.city_id,m.city_id,c.city_id);
 if new.city_id is not null and not exists (
   select 1 from public.places where id=new.city_id and source_key is not null
 ) then raise exception 'City unavailable'; end if;
 if new.contribution_type='complete_sdg_mission' then
  if m.id is null or m.created_by_actor_id<>new.actor_id then raise exception 'Only the mission creator may complete the mission'; end if;
 end if;
 if new.contribution_type='complete_wifi_community' then
  if c.id is null or not exists(select 1 from public.mesh_community_members x where x.community_id=c.id and x.actor_id=new.actor_id and x.member_role='steward') then
   raise exception 'Only a community steward may complete the implementation';
  end if;
 end if;
 return new;
end $$;
