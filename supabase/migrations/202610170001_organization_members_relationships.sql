-- PR #32: ordinary membership requests and organization business relationships.
-- Apply only after PR #31 (organization access) is migrated and reviewed.
-- Nothing in this migration grants an ordinary member the ability to act as an organization.

create table public.organization_membership_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 requester_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references public.profiles(id),
 constraint organization_membership_decision_state check (
   (status='pending' and decided_at is null and decided_by is null)
   or (status in ('accepted','declined') and decided_at is not null and decided_by is not null)
 )
);
create unique index org_membership_one_pending
 on public.organization_membership_requests (organization_id,requester_id)
 where status='pending';
create index org_membership_inbox on public.organization_membership_requests (organization_id,status,created_at desc);

alter table public.organization_membership_requests enable row level security;
revoke all on public.organization_membership_requests from public,anon,authenticated;
grant select,insert on public.organization_membership_requests to authenticated;
create policy "Membership requester or organization admin can read" on public.organization_membership_requests
 for select to authenticated using (
 requester_id=(select auth.uid())
 or exists (
  select 1 from public.organization_members m
  where m.organization_id=organization_membership_requests.organization_id
    and m.profile_id=(select auth.uid()) and m.member_role='admin'
 )
);
create policy "Authenticated user requests ordinary membership only" on public.organization_membership_requests
 for insert to authenticated with check (
 requester_id=(select auth.uid()) and status='pending'
 and decided_at is null and decided_by is null
 and exists (
  select 1 from public.organizations o
  where o.id=organization_id and o.removed_at is null
 )
 and not exists (
  select 1 from public.organization_members m
  where m.organization_id=organization_membership_requests.organization_id
    and m.profile_id=(select auth.uid())
 )
);

-- Existing notifications are visible through the organization actor only to admins.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
 check (kind in ('follow','connection','comment','reaction','message','membership'));

create function public.notify_organization_membership_request()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_sender uuid; v_receiver uuid;
begin
 select a.id into v_sender from public.actors a where a.profile_id=new.requester_id;
 select a.id into v_receiver from public.actors a where a.organization_id=new.organization_id;
 if v_receiver is not null then
  insert into public.notifications (recipient_actor_id,sender_actor_id,kind,target_id)
  values (v_receiver,v_sender,'membership',new.organization_id);
 end if;
 return new;
end
$$;
revoke all on function public.notify_organization_membership_request() from public,anon,authenticated;
create trigger organization_membership_notification
 after insert on public.organization_membership_requests
 for each row execute function public.notify_organization_membership_request();

-- Atomic approval/decline. Only a verified, existing org admin may decide.
create function public.review_organization_membership(p_request uuid,p_decision text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_req public.organization_membership_requests%rowtype; v_admin uuid := auth.uid();
begin
 if v_admin is null or p_decision not in ('accepted','declined') then
  raise exception 'Invalid membership decision';
 end if;
 select * into v_req from public.organization_membership_requests
 where id=p_request for update;
 if not found or v_req.status<>'pending' then return false; end if;
 if not exists (
  select 1 from public.organization_members m
  join public.organizations o on o.id=m.organization_id
  where m.organization_id=v_req.organization_id and m.profile_id=v_admin
    and m.member_role='admin' and o.removed_at is null
 ) then raise exception 'Not permitted'; end if;
 if p_decision='accepted' then
  insert into public.organization_members (organization_id,profile_id,member_role)
  values(v_req.organization_id,v_req.requester_id,'member')
  on conflict (organization_id,profile_id) do nothing;
 end if;
 update public.organization_membership_requests
 set status=p_decision,decided_at=now(),decided_by=v_admin where id=p_request;
 insert into public.organization_access_audit (organization_id,actor_id,subject_id,action)
 values(v_req.organization_id,v_admin,v_req.requester_id,
        case when p_decision='accepted' then 'membership_approved' else 'membership_declined' end);
 return true;
end
$$;
revoke all on function public.review_organization_membership(uuid,text) from public,anon,authenticated;
grant execute on function public.review_organization_membership(uuid,text) to authenticated;

-- Companies can have named partnerships and sponsorships with many actors.
create table public.organization_relationships (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 kind text not null check (kind in ('partnership','sponsorship')),
 name text not null check (char_length(trim(name)) between 2 and 160),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index organization_relationships_lookup on public.organization_relationships (organization_id,kind,created_at desc);
create table public.organization_relationship_actors (
 relationship_id uuid not null references public.organization_relationships(id) on delete cascade,
 actor_id uuid not null references public.actors(id),
 primary key (relationship_id,actor_id)
);
create index organization_relationship_actor_lookup on public.organization_relationship_actors(actor_id);
alter table public.organization_relationships enable row level security;
alter table public.organization_relationship_actors enable row level security;
revoke all on public.organization_relationships,public.organization_relationship_actors from public,anon,authenticated;
grant select on public.organization_relationships,public.organization_relationship_actors to authenticated;
create policy "Read business relationships" on public.organization_relationships
 for select to authenticated using (true);
create policy "Read relationship participants" on public.organization_relationship_actors
 for select to authenticated using (true);

-- All writes are serialized by this atomic RPC; no browser write grants to either table.
create function public.save_organization_relationship(
 p_organization uuid,p_kind text,p_name text,p_actors uuid[],p_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_unique uuid[];
begin
 if v_user is null
    or p_kind not in ('partnership','sponsorship')
    or char_length(trim(coalesce(p_name,''))) not between 2 and 160 then
  raise exception 'Invalid relationship';
 end if;
 if not exists (
  select 1 from public.organizations o
  join public.organization_members m on m.organization_id=o.id
  where o.id=p_organization and o.organization_type='company'
    and o.removed_at is null and m.profile_id=v_user and m.member_role='admin'
 ) then raise exception 'Not permitted'; end if;
 select coalesce(array_agg(distinct u.actor),array[]::uuid[]) into v_unique
 from unnest(coalesce(p_actors,array[]::uuid[])) as u(actor);
 if cardinality(v_unique)>30
    or exists (
      select 1 from unnest(v_unique) as a(actor)
      where a.actor is null or not exists(select 1 from public.actors b where b.id=a.actor)
    ) then raise exception 'Invalid relationship participants'; end if;
 if p_id is null then
  insert into public.organization_relationships (organization_id,kind,name,created_by)
  values (p_organization,p_kind,trim(p_name),v_user) returning id into v_id;
 else
  update public.organization_relationships
  set name=trim(p_name),kind=p_kind,updated_at=now()
  where id=p_id and organization_id=p_organization returning id into v_id;
  if v_id is null then raise exception 'Relationship not found'; end if;
  delete from public.organization_relationship_actors where relationship_id=v_id;
 end if;
 insert into public.organization_relationship_actors(relationship_id,actor_id)
 select v_id,a.actor from unnest(v_unique) as a(actor);
 insert into public.organization_access_audit(organization_id,actor_id,action,details)
 values(p_organization,v_user,case when p_id is null then 'relationship_created' else 'relationship_updated' end,
        jsonb_build_object('relationship_id',v_id,'kind',p_kind));
 return v_id;
end
$$;
revoke all on function public.save_organization_relationship(uuid,text,text,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.save_organization_relationship(uuid,text,text,uuid[],uuid) to authenticated;

create function public.delete_organization_relationship(p_organization uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_kind text;
begin
 if v_user is null or not exists (
  select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization and m.profile_id=v_user and m.member_role='admin'
    and o.organization_type='company' and o.removed_at is null
 ) then raise exception 'Not permitted'; end if;
 delete from public.organization_relationships
 where id=p_id and organization_id=p_organization returning kind into v_kind;
 if v_kind is null then return false; end if;
 insert into public.organization_access_audit(organization_id,actor_id,action,details)
 values(p_organization,v_user,'relationship_deleted',
        jsonb_build_object('relationship_id',p_id,'kind',v_kind));
 return true;
end
$$;
revoke all on function public.delete_organization_relationship(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_organization_relationship(uuid,uuid) to authenticated;
