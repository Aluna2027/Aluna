-- Aluna Super Admin role management: serialize changes per organization and audit atomically.
create or replace function public.aluna_admin_set_organization_role(
 p_organization uuid, p_profile uuid, p_role text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_old public.organization_member_role;
begin
 if v_actor is null or not exists(
   select 1 from public.aluna_super_admins where profile_id=v_actor
 ) then
   raise exception 'Super Admin access required' using errcode='42501';
 end if;
 if p_role not in ('admin','member') then
   raise exception 'Invalid organization role' using errcode='22023';
 end if;
 -- Organization-level row lock prevents concurrent last-admin demotions.
 perform 1 from public.organizations
 where id=p_organization and removed_at is null for update;
 if not found then raise exception 'Active organization not found' using errcode='P0002'; end if;
 select member_role into v_old from public.organization_members
 where organization_id=p_organization and profile_id=p_profile for update;
 if not found then raise exception 'Organization member not found' using errcode='P0002'; end if;
 if v_old::text=p_role then return 'unchanged'; end if;
 if v_old='admin' and p_role='member' and (
   select count(*) from public.organization_members
   where organization_id=p_organization and member_role='admin'
 ) <= 1 then
   raise exception 'Cannot remove the last Organization Admin' using errcode='23514';
 end if;
 update public.organization_members set member_role=p_role::public.organization_member_role
 where organization_id=p_organization and profile_id=p_profile;
 insert into public.organization_access_audit
   (organization_id,actor_id,subject_id,action,details)
 values
   (p_organization,v_actor,p_profile,'organization_role_changed',
    jsonb_build_object('previous_role',v_old::text,'new_role',p_role));
 return 'updated';
end;
$$;
revoke all on function public.aluna_admin_set_organization_role(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.aluna_admin_set_organization_role(uuid,uuid,text) to authenticated;
