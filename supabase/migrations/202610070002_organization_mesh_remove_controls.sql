alter table public.organizations
 add column if not exists removed_at timestamptz null;

alter table public.mesh_communities
 add column if not exists removed_at timestamptz null;

create index if not exists organizations_removed_at_idx
 on public.organizations(removed_at);

create index if not exists mesh_communities_removed_at_idx
 on public.mesh_communities(removed_at);

create or replace function public.can_act_as(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists(
   select 1
   from public.actors a
   left join public.organizations o on o.id=a.organization_id
   where a.id=p_actor
     and (
       a.profile_id=auth.uid()
       or (
         a.organization_id is not null
         and o.removed_at is null
         and exists(
           select 1
           from public.organization_members m
           where m.organization_id=a.organization_id
             and m.profile_id=auth.uid()
             and m.member_role='admin'
         )
       )
     )
 )
$$;

create or replace function public.can_manage_mesh_community(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists(
   select 1
   from public.mesh_communities c
   join public.mesh_community_members m on m.community_id=c.id
   where c.id=p_id
     and c.removed_at is null
     and m.member_role='steward'
     and public.can_act_as(m.actor_id)
 )
$$;

create or replace function public.remove_organization(p_organization uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;

 if not exists(
   select 1
   from public.organizations o
   join public.organization_members m on m.organization_id=o.id
   where o.id=p_organization
     and o.removed_at is null
     and m.profile_id=auth.uid()
     and m.member_role='admin'
 ) then
   raise exception 'Not permitted';
 end if;

 update public.organizations
 set removed_at=now(),updated_at=now()
 where id=p_organization and removed_at is null;

 return 'removed';
end
$$;

revoke all on function public.remove_organization(uuid) from public,anon;
grant execute on function public.remove_organization(uuid) to authenticated;

create or replace function public.remove_mesh_community(p_community uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
begin
 if not public.can_manage_mesh_community(p_community) then
   raise exception 'Not permitted';
 end if;

 update public.mesh_communities
 set removed_at=now(),updated_at=now()
 where id=p_community and removed_at is null;

 update public.missions
 set community_id=null,updated_at=now()
 where community_id=p_community;

 update public.contributions
 set community_id=null
 where community_id=p_community;

 update public.posts
 set community_id=null,updated_at=now()
 where community_id=p_community;

 return 'removed';
end
$$;

revoke all on function public.remove_mesh_community(uuid) from public,anon;
grant execute on function public.remove_mesh_community(uuid) to authenticated;
