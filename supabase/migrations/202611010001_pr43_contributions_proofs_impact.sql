-- PR43: additive, backward-compatible contribution / verification data model.
-- Apply only to an isolated test environment before promoting to shared Demo.
alter table public.contributions add column if not exists submission_id uuid;
alter table public.contributions add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.contributions drop constraint if exists contributions_contribution_type_check;
alter table public.contributions add constraint contributions_contribution_type_check
 check (contribution_type in ('data','time','skills','work','money','equipment','services','materials','research','complete_sdg_mission','complete_wifi_community'));

create table if not exists public.pr43_contribution_results (
 id uuid primary key default gen_random_uuid(),
 contribution_id uuid not null references public.contributions(id) on delete restrict,
 metric_key text not null check (metric_key in ('people_connected','nodes_installed','local_owners','money_invested','volunteer_hours','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed','contribution_verified')),
 quantity numeric(18,2) not null check (quantity >= 0 and quantity <= 1000000000),
 unit text not null default 'count',
 source_reference text,
 indicator text,
 sdg_numbers integer[] not null default '{}',
 measured_on date not null,
 verified_quantity numeric(18,2),
 verification_level smallint not null default 0 check (verification_level between 0 and 4),
 proof_id uuid unique references public.proofs(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint pr43_unique_metric_per_contribution unique(contribution_id,metric_key),
 constraint pr43_verified_amount_check check (verified_quantity is null or (verified_quantity >= 0 and verified_quantity <= 1000000000)),
 constraint pr43_sdg_range check (sdg_numbers <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17])
);
create index if not exists pr43_result_metric_idx on public.pr43_contribution_results(metric_key,verification_level);
-- A measurement batch can legitimately report several metric types. Never make the batch reference globally unique;
-- maintain an index for audit/reconciliation and use latest verified community snapshots for stock metrics.
create index if not exists pr43_result_source_reference_idx on public.pr43_contribution_results(metric_key,source_reference) where source_reference is not null;


-- An explicit Aluna assignment, per result, gates independent review and evidence access.
create table if not exists public.pr43_l3_assignments (
 result_id uuid primary key references public.pr43_contribution_results(id) on delete restrict,
 reviewer_profile_id uuid not null references public.profiles(id) on delete restrict,
 reviewer_actor_id uuid not null references public.actors(id) on delete restrict,
 assigned_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 assigned_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index if not exists pr43_l3_assignee_idx on public.pr43_l3_assignments(reviewer_profile_id) where revoked_at is null;
alter table public.pr43_l3_assignments enable row level security;
create policy "PR43 read own L3 assignments" on public.pr43_l3_assignments
 for select to authenticated using (reviewer_profile_id=auth.uid() or public.is_aluna_admin());
revoke all on public.pr43_l3_assignments from public,anon,authenticated;
grant select on public.pr43_l3_assignments to authenticated;

create table if not exists public.pr43_contribution_reviews (
 id uuid primary key default gen_random_uuid(),
 result_id uuid not null references public.pr43_contribution_results(id) on delete restrict,
 reviewer_actor_id uuid not null references public.actors(id) on delete restrict,
 reviewer_profile_id uuid not null references public.profiles(id) on delete restrict,
 role text not null check (role in ('owner','organization','independent','aluna')),
 confirmed_quantity numeric(18,2) not null check (confirmed_quantity >= 0 and confirmed_quantity <= 1000000000),
 impact_result text,
 reviewed_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index if not exists pr43_reviews_result_idx on public.pr43_contribution_reviews(result_id);
create unique index if not exists pr43_active_review_role on public.pr43_contribution_reviews(result_id,role) where revoked_at is null;

create table if not exists public.pr43_contribution_files (
 id uuid primary key default gen_random_uuid(),
 contribution_id uuid not null references public.contributions(id) on delete restrict,
 storage_path text not null unique,
 filename text not null,
 content_type text not null,
 uploaded_at timestamptz not null default now()
);
alter table public.pr43_contribution_results enable row level security;
alter table public.pr43_contribution_reviews enable row level security;
alter table public.pr43_contribution_files enable row level security;
create policy "PR43 read results" on public.pr43_contribution_results for select to authenticated using(true);
create policy "PR43 read reviews" on public.pr43_contribution_reviews for select to authenticated using(true);
create policy "PR43 read attachments" on public.pr43_contribution_files for select to authenticated using (
  public.is_aluna_admin()
  or exists (
    select 1 from public.contributions c
    where c.id=contribution_id and public.can_act_as(c.actor_id)
  )
  or exists (
    select 1 from public.pr43_l3_assignments assignment
    join public.pr43_contribution_results r on r.id=assignment.result_id
    where r.contribution_id=pr43_contribution_files.contribution_id
      and r.verification_level>=2 and assignment.reviewer_profile_id=auth.uid()
      and assignment.revoked_at is null
  )
  or exists (
    select 1 from public.contributions c
    join public.mission_participations mp on mp.mission_id=c.mission_id
    join public.actors actor on actor.id=mp.actor_id and actor.organization_id is not null
    join public.organization_members om on om.organization_id=actor.organization_id
      and om.profile_id=auth.uid() and om.member_role='admin'
    where c.id=contribution_id
  )
  or exists (
    select 1 from public.contributions c
    join public.mesh_community_members cm on cm.community_id=c.community_id
    join public.actors actor on actor.id=cm.actor_id and actor.organization_id is not null
    join public.organization_members om on om.organization_id=actor.organization_id
      and om.profile_id=auth.uid() and om.member_role='admin'
    where c.id=contribution_id
  )
);
create policy "PR43 save attachments" on public.pr43_contribution_files for insert to authenticated
 with check (exists(select 1 from public.contributions c where c.id=contribution_id and public.can_act_as(c.actor_id)));

create policy "PR43 independent reviewer uploads" on public.pr43_contribution_files
 for insert to authenticated with check (
  public.is_aluna_admin()
  or exists (
   select 1 from public.pr43_l3_assignments assignment
   join public.pr43_contribution_results linked on linked.id=assignment.result_id
   where linked.contribution_id=pr43_contribution_files.contribution_id
     and linked.verification_level>=2
     and assignment.reviewer_profile_id=auth.uid() and assignment.revoked_at is null
  )
  or exists (
   select 1 from public.contributions c
   join public.mission_participations mp on mp.mission_id=c.mission_id
   join public.actors a on a.id=mp.actor_id and a.organization_id is not null
   join public.organization_members om on om.organization_id=a.organization_id
     and om.profile_id=auth.uid() and om.member_role='admin'
   where c.id=contribution_id
  )
  or exists (
   select 1 from public.contributions c
   join public.mesh_community_members cm on cm.community_id=c.community_id
   join public.actors a on a.id=cm.actor_id and a.organization_id is not null
   join public.organization_members om on om.organization_id=a.organization_id
     and om.profile_id=auth.uid() and om.member_role='admin'
   where c.id=contribution_id
  )
 );
revoke all on public.pr43_contribution_results,public.pr43_contribution_reviews from anon,authenticated;
grant select on public.pr43_contribution_results,public.pr43_contribution_reviews to authenticated;
revoke all on public.pr43_contribution_files from anon,authenticated;
grant select,insert on public.pr43_contribution_files to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('contribution-evidence','contribution-evidence',false,20971520,
 array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
 on conflict(id) do nothing;
create policy "PR43 evidence read" on storage.objects for select to authenticated using(
 bucket_id='contribution-evidence' and (
  (storage.foldername(name))[1]=auth.uid()::text or public.is_aluna_admin()
  or exists(
   select 1 from public.pr43_contribution_files attached
   join public.pr43_contribution_results linked on linked.contribution_id=attached.contribution_id
   join public.pr43_l3_assignments assignment on assignment.result_id=linked.id
   where attached.storage_path=objects.name and linked.verification_level>=2
     and assignment.reviewer_profile_id=auth.uid() and assignment.revoked_at is null
  )
  or exists(
   select 1 from public.pr43_contribution_files f
   join public.contributions c on c.id=f.contribution_id
   where f.storage_path=name and (
    public.can_act_as(c.actor_id)
    or exists(
     select 1 from public.mission_participations mp
     join public.actors a on a.id=mp.actor_id and a.organization_id is not null
     join public.organization_members om on om.organization_id=a.organization_id
       and om.profile_id=auth.uid() and om.member_role='admin'
     where mp.mission_id=c.mission_id)
    or exists(
     select 1 from public.mesh_community_members cm
     join public.actors a on a.id=cm.actor_id and a.organization_id is not null
     join public.organization_members om on om.organization_id=a.organization_id
       and om.profile_id=auth.uid() and om.member_role='admin'
     where cm.community_id=c.community_id)
   )
  )
 )
);
create policy "PR43 evidence upload" on storage.objects for insert to authenticated
 with check (bucket_id='contribution-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- Block unlinked contributions and restrict project completion to its owner / steward.
create or replace function public.pr43_guard_contribution()
returns trigger language plpgsql security definer set search_path='' as $$
declare m public.missions%rowtype; c public.mesh_communities%rowtype;
begin
 if new.mission_id is null and new.community_id is null then raise exception 'A mission or community is required'; end if;
 if new.mission_id is not null then
  select * into m from public.missions where id=new.mission_id and removed_at is null;
  if not found then raise exception 'Mission unavailable'; end if;
 end if;
 if new.community_id is not null then
  select * into c from public.mesh_communities where id=new.community_id and removed_at is null;
  if not found then raise exception 'Community unavailable'; end if;
 end if;
 if new.mission_id is not null and new.community_id is not null then
  if m.community_id is distinct from c.id then raise exception 'Mission must be linked to selected community'; end if;
 end if;
 if new.mission_id is not null and new.community_id is not null and m.city_id is distinct from c.city_id then
  raise exception 'Project cities must match';
 end if;
 if new.city_id is not null and (new.mission_id is not null and m.city_id is not null and new.city_id<>m.city_id or new.community_id is not null and new.city_id<>c.city_id) then
  raise exception 'City mismatch';
 end if;
 new.city_id:=coalesce(new.city_id,m.city_id,c.city_id);
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
revoke execute on function public.pr43_guard_contribution() from public,anon,authenticated;
drop trigger if exists contribution_place_guard on public.contributions;
create trigger contribution_place_guard before insert on public.contributions for each row execute function public.pr43_guard_contribution();
create unique index if not exists pr43_unique_sdg_completion on public.contributions(mission_id) where contribution_type='complete_sdg_mission';
create unique index if not exists pr43_unique_wifi_completion on public.contributions(community_id) where contribution_type='complete_wifi_community';

-- A single RPC groups the selected types. All records are inserted atomically.
create or replace function public.pr43_record_contributions(p_actor uuid,p_mission uuid,p_community uuid,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare grp uuid:=gen_random_uuid(); entry jsonb; result jsonb; c_id uuid; t text; detail jsonb;
key text; amount numeric; unit_name text; src text; indicator_name text; sdgs integer[];
begin
 if auth.uid() is null or not public.can_act_as(p_actor) then raise exception 'Actor not authorized'; end if;
 if p_mission is null and p_community is null then raise exception 'Project is required'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>11 then raise exception 'Invalid types'; end if;
 for entry in select value from jsonb_array_elements(p_items) loop
  t:=entry->>'type';detail:=coalesce(entry->'details','{}'::jsonb);
  if t not in ('data','time','skills','work','money','equipment','services','materials','research','complete_sdg_mission','complete_wifi_community')
    or char_length(trim(coalesce(entry->>'title',''))) not between 3 and 160
    or char_length(trim(coalesce(entry->>'description',''))) not between 10 and 3000
    or coalesce(entry->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(detail)<>'object' then raise exception 'Invalid contribution'; end if;
  insert into public.contributions(submission_id,actor_id,mission_id,community_id,contribution_type,title,description,contributed_on,details,quantity,quantity_unit)
   values(grp,p_actor,p_mission,p_community,t,trim(entry->>'title'),trim(entry->>'description'),(entry->>'date')::date,detail,
    case when t='time' then nullif(detail->>'hours','')::numeric else null end,
    case when t='time' then 'hours' else null end) returning id into c_id;
  if t='complete_sdg_mission' and detail->>'completion_status'<>'all' then raise exception 'Cannot mark an unfinished mission as completed'; end if;
  if t='complete_wifi_community' and (detail->>'completion_status'<>'all' or detail->>'operational'<>'yes') then raise exception 'Network implementation must be completed and operational'; end if;
  if t='time' and coalesce(nullif(detail->>'hours','')::numeric,0)<=0 then raise exception 'Volunteer hours are required'; end if;
  if jsonb_typeof(entry->'metrics')<>'array' then raise exception 'Measurements required'; end if;
  if jsonb_array_length(entry->'metrics')=0 then raise exception 'At least one result is required'; end if;
  for result in select value from jsonb_array_elements(entry->'metrics') loop
   key:=result->>'key';
   if key not in ('people_connected','nodes_installed','local_owners','money_invested','volunteer_hours','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed','contribution_verified')
    or coalesce(result->>'quantity','') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Invalid metric'; end if;
   amount:=(result->>'quantity')::numeric;
   if amount<0 or amount>1000000000 then raise exception 'Metric outside allowed range'; end if;
   if (t='time' and key<>'volunteer_hours') or
      (t='skills' and key<>'skills_contributed') or
      (t='complete_sdg_mission' and key<>'mission_completed') or
      (t='complete_wifi_community' and key<>'wifi_completed') or
      (t='data' and key not in ('people_connected','nodes_installed','local_owners','money_invested','sdg_metrics','community_data')) or
      (t not in ('time','skills','data','complete_sdg_mission','complete_wifi_community') and key not in ('contribution_verified')) then
      raise exception 'Metric not allowed for this contribution type';
   end if;
   unit_name:=coalesce(nullif(result->>'unit',''),'count');
   src:=nullif(trim(result->>'reference'),'');
   indicator_name:=nullif(trim(result->>'indicator'),'');
   select coalesce(array_agg(value::integer),'{}') into sdgs from jsonb_array_elements_text(coalesce(result->'sdgs','[]'::jsonb)) value;
   if key='sdg_metrics' and (indicator_name is null or cardinality(sdgs)=0) then raise exception 'SDG indicator and goals required'; end if;
   if key in ('people_connected','nodes_installed','local_owners','money_invested') and src is null then
     raise exception 'A unique source or batch reference is required for this metric';
   end if;
   if key in ('people_connected','nodes_installed','local_owners') and p_community is null then
     raise exception 'Select the related Wi-Fi Mesh Community for network measurements';
   end if;
   if key in ('people_connected','nodes_installed','local_owners','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed') and amount<>trunc(amount) then
     raise exception 'This metric requires a whole number';
   end if;
   insert into public.pr43_contribution_results(contribution_id,metric_key,quantity,unit,source_reference,indicator,sdg_numbers,measured_on)
    values(c_id,key,amount,unit_name,src,indicator_name,sdgs,(entry->>'date')::date);
  end loop;
 end loop;
 return grp;
end $$;
revoke all on function public.pr43_record_contributions(uuid,uuid,uuid,jsonb) from public;
grant execute on function public.pr43_record_contributions(uuid,uuid,uuid,jsonb) to authenticated;

-- Every metric is reviewed separately. The reviewer chooses what was actually verified.
create or replace function public.pr43_review_result(p_result uuid,p_actor uuid,p_value numeric,p_impact_result text default null)
returns smallint language plpgsql security definer set search_path='' as $$
declare
 r public.pr43_contribution_results%rowtype;
 contributor public.contributions%rowtype;
 reviewer_org uuid;
 contributor_org uuid;
 l2_org uuid;
 l2_actor uuid;
 reviewer_level smallint;
 v_next smallint;
 v_role text;
 v_method text;
 v_proof uuid;
begin
 if auth.uid() is null or p_actor is null or not public.can_act_as(p_actor) then
  raise exception 'Reviewer not authorized';
 end if;
 select * into r from public.pr43_contribution_results where id=p_result for update;
 if not found then raise exception 'Result not found'; end if;
 select * into contributor from public.contributions where id=r.contribution_id;
 if not found then raise exception 'Linked contribution not found'; end if;
 if r.verification_level=4 then raise exception 'Already at L4. Revoke to correct an error'; end if;
 if p_value is null or p_value<0 or p_value>1000000000
    or (p_value<>trunc(p_value) and r.metric_key in
      ('people_connected','nodes_installed','local_owners','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed','contribution_verified')) then
  raise exception 'Invalid confirmed quantity';
 end if;
 if char_length(coalesce(p_impact_result,''))>3000
   or char_length(trim(coalesce(p_impact_result,''))) between 1 and 9 then
  raise exception 'Impact result must be empty or contain 10 to 3000 characters';
 end if;
 if exists(select 1 from public.pr43_contribution_reviews x
            where x.result_id=p_result and x.revoked_at is null and x.reviewer_profile_id=auth.uid()) then
  raise exception 'Same person cannot perform multiple verification levels';
 end if;
 select organization_id into reviewer_org from public.actors where id=p_actor;
 select organization_id into contributor_org from public.actors where id=contributor.actor_id;
 select max_level into reviewer_level from public.proof_verifier_grants where profile_id=auth.uid();
 v_next:=r.verification_level+1;

 if v_next=1 then
  if p_actor<>contributor.actor_id then raise exception 'L1 requires the original contributing actor'; end if;
  v_role:='owner';v_method:='self_report';
 elsif v_next=2 then
  if reviewer_org is null or public.can_act_as(contributor.actor_id) then
   raise exception 'L2 requires a separate organization and contributor';
  end if;
  if not (
   exists(select 1 from public.mission_participations mp
          where mp.mission_id=contributor.mission_id and mp.actor_id=p_actor)
   or exists(select 1 from public.missions m
          where m.id=contributor.mission_id and m.created_by_actor_id=p_actor)
   or exists(select 1 from public.mesh_community_members cm
          where cm.community_id=contributor.community_id and cm.actor_id=p_actor)
  ) then raise exception 'L2 organization must be involved in the selected project'; end if;
  v_role:='organization';v_method:='peer_attestation';
 elsif v_next=3 then
  if not exists (
    select 1 from public.pr43_l3_assignments assignment
    where assignment.result_id=p_result and assignment.reviewer_profile_id=auth.uid()
      and assignment.reviewer_actor_id=p_actor and assignment.revoked_at is null
  ) then raise exception 'L3 requires explicit Aluna assignment for this result'; end if;
  if reviewer_org is null or coalesce(reviewer_level,0)<3 or public.can_act_as(contributor.actor_id) then
   raise exception 'L3 requires an authorized independent organization';
  end if;
  select x.reviewer_actor_id into l2_actor from public.pr43_contribution_reviews x
   where x.result_id=p_result and x.role='organization' and x.revoked_at is null;
  select organization_id into l2_org from public.actors where id=l2_actor;
  if l2_org is null or reviewer_org=l2_org or reviewer_org=contributor_org then
   raise exception 'L3 cannot be the contributor or L2 organization';
  end if;
  if exists(select 1 from public.organization_members a
      join public.organization_members b on b.profile_id=a.profile_id
      where a.organization_id=reviewer_org and b.organization_id=l2_org)
    or (contributor_org is not null and exists(
      select 1 from public.organization_members a
      join public.organization_members b on b.profile_id=a.profile_id
      where a.organization_id=reviewer_org and b.organization_id=contributor_org)) then
    raise exception 'L3 shares administration with an affiliated organization';
  end if;
  if exists(select 1 from public.mission_participations mp
        where mp.mission_id=contributor.mission_id and mp.actor_id=p_actor)
    or exists(select 1 from public.mesh_community_members cm
        where cm.community_id=contributor.community_id and cm.actor_id=p_actor)
    or exists(select 1 from public.missions m
        where m.id=contributor.mission_id and m.created_by_actor_id=p_actor) then
    raise exception 'L3 reviewer is involved in the project';
  end if;
  v_role:='independent';v_method:='partner_review';
 elsif v_next=4 then
  if not public.is_aluna_admin() or public.can_act_as(contributor.actor_id) then
   raise exception 'L4 requires a separate authorized Aluna administrator';
  end if;
  v_role:='aluna';v_method:='ground_visit';
 else
  raise exception 'Verification sequence invalid';
 end if;

 insert into public.pr43_contribution_reviews
   (result_id,reviewer_actor_id,reviewer_profile_id,role,confirmed_quantity,impact_result)
 values(p_result,p_actor,auth.uid(),v_role,p_value,nullif(trim(coalesce(p_impact_result,'')),''));

 if r.proof_id is null then
  insert into public.proofs
   (actor_id,mission_id,city_id,contribution_id,evidence_type,evidence_description,result_text,occurred_on,verification_level)
  values(contributor.actor_id,contributor.mission_id,contributor.city_id,contributor.id,'partner_confirmation',
   'Project contribution review with linked records and supporting attachments.',
   coalesce(nullif(trim(coalesce(p_impact_result,'')),''),contributor.title||' — reported project contribution'),
   current_date,1)
  returning id into v_proof;
  update public.pr43_contribution_results set proof_id=v_proof where id=p_result;
 else
  v_proof:=r.proof_id;
  update public.proofs set verification_level=v_next where id=v_proof;
 end if;
 insert into public.proof_verification_events
  (proof_id,previous_level,new_level,verifier_actor_id,verifier_profile_id,method,reason)
 values(v_proof,case when v_next=1 then null else v_next-1 end,v_next,p_actor,auth.uid(),
  v_method,'PR43 role-separated verification with recorded actor, measured quantity and evidence.');

 update public.pr43_contribution_results
 set verification_level=v_next,
     verified_quantity=case when v_next>=3 then p_value else null end
 where id=p_result;
 return v_next;
end $$;

-- Admin-only assignment: reviewers must be accredited and independent of the contributor and L2 organization.
create or replace function public.pr43_assign_l3(p_result uuid,p_reviewer_profile uuid,p_reviewer_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 r public.pr43_contribution_results%rowtype;
 c public.contributions%rowtype;
 reviewer_org uuid;
 contributor_org uuid;
 l2_org uuid;
begin
 if auth.uid() is null or not public.is_aluna_admin() then raise exception 'Aluna administrator required'; end if;
 select * into r from public.pr43_contribution_results where id=p_result for update;
 if not found or r.verification_level<>2 then raise exception 'A result verified at L2 is required'; end if;
 select * into c from public.contributions where id=r.contribution_id;
 select organization_id into reviewer_org from public.actors where id=p_reviewer_actor;
 select organization_id into contributor_org from public.actors where id=c.actor_id;
 select a.organization_id into l2_org
 from public.pr43_contribution_reviews rv join public.actors a on a.id=rv.reviewer_actor_id
 where rv.result_id=p_result and rv.role='organization' and rv.revoked_at is null;
 if reviewer_org is null or l2_org is null or reviewer_org=l2_org or reviewer_org=contributor_org
    or p_reviewer_profile is null or p_reviewer_profile=auth.uid()
    or not exists (select 1 from public.organization_members om
        where om.organization_id=reviewer_org and om.profile_id=p_reviewer_profile and om.member_role='admin')
    or not exists (select 1 from public.proof_verifier_grants g
        where g.profile_id=p_reviewer_profile and g.max_level>=3)
 then raise exception 'Reviewer is not an eligible independent organization administrator'; end if;
 if exists(select 1 from public.organization_members x
    join public.organization_members y on y.profile_id=x.profile_id
    where x.organization_id=reviewer_org and y.organization_id=l2_org)
   or (contributor_org is not null and exists (
    select 1 from public.organization_members x
    join public.organization_members y on y.profile_id=x.profile_id
    where x.organization_id=reviewer_org and y.organization_id=contributor_org))
   or exists(select 1 from public.actors own
        where own.id=c.actor_id and own.profile_id=p_reviewer_profile)
   or exists(select 1 from public.mission_participations mp
        join public.actors involved on involved.id=mp.actor_id
        where mp.mission_id=c.mission_id and involved.organization_id=reviewer_org)
   or exists(select 1 from public.mesh_community_members cm
        join public.actors involved on involved.id=cm.actor_id
        where cm.community_id=c.community_id and involved.organization_id=reviewer_org)
   or exists(select 1 from public.missions m
        join public.actors creator on creator.id=m.created_by_actor_id
        where m.id=c.mission_id and creator.organization_id=reviewer_org)
 then raise exception 'Independent reviewer has a conflict of interest'; end if;
 insert into public.pr43_l3_assignments (result_id,reviewer_profile_id,reviewer_actor_id,assigned_by_profile_id)
 values(p_result,p_reviewer_profile,p_reviewer_actor,auth.uid())
 on conflict (result_id) do update set
  reviewer_profile_id=excluded.reviewer_profile_id,
  reviewer_actor_id=excluded.reviewer_actor_id,
  assigned_by_profile_id=excluded.assigned_by_profile_id,
  assigned_at=now(),revoked_at=null;
end $$;
revoke all on function public.pr43_assign_l3(uuid,uuid,uuid) from public,anon;
grant execute on function public.pr43_assign_l3(uuid,uuid,uuid) to authenticated;

revoke all on function public.pr43_review_result(uuid,uuid,numeric,text) from public;
grant execute on function public.pr43_review_result(uuid,uuid,numeric,text) to authenticated;

-- Scope-safe, server-side aggregation. Repeated network snapshots do not
-- inflate the latest actual concurrent connections, installed nodes or owners.
create or replace function public.pr43_impact_rollup(
 p_actor uuid default null, p_mission uuid default null, p_community uuid default null, p_city uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with scoped as (
  select r.id, r.metric_key, r.verified_quantity, r.measured_on, r.created_at,
         c.id as contribution_id,c.actor_id,c.mission_id,c.community_id,c.city_id,
         a.organization_id
  from public.pr43_contribution_results r
  join public.contributions c on c.id=r.contribution_id
  join public.actors a on a.id=c.actor_id
  where auth.uid() is not null
    and r.verification_level>=case when r.metric_key='money_invested' then 4 else 3 end and r.verified_quantity is not null
    and (p_actor is null or c.actor_id=p_actor)
    and (p_mission is null or c.mission_id=p_mission)
    and (p_community is null or c.community_id=p_community)
    and (p_city is null or c.city_id=p_city)
 ),
 snapshots as (
  select distinct on (metric_key,coalesce(community_id::text,mission_id::text))
    metric_key,verified_quantity
  from scoped
  where metric_key in ('people_connected','nodes_installed','local_owners')
  order by metric_key,coalesce(community_id::text,mission_id::text),
           measured_on desc,created_at desc,id desc
 ),
 ordinary as (
  select coalesce(sum(verified_quantity) filter(where metric_key='money_invested'),0) as invested,
    coalesce(sum(verified_quantity) filter(where metric_key='volunteer_hours'),0) as hours,
    coalesce(sum(verified_quantity) filter(where metric_key='skills_contributed'),0) as skills,
    count(distinct mission_id) filter(where metric_key='mission_completed') as completed,
    count(id) filter(where metric_key='sdg_metrics') as sdgs,
    coalesce(sum(verified_quantity) filter(where metric_key='community_data'),0) as data_count,
    count(distinct organization_id) filter(where organization_id is not null) as orgs,
    count(id) as verified
  from scoped
 )
 select jsonb_build_object(
  'peopleConnected',coalesce((select sum(verified_quantity) from snapshots where metric_key='people_connected'),0),
  'nodesInstalled',coalesce((select sum(verified_quantity) from snapshots where metric_key='nodes_installed'),0),
  'localOwners',coalesce((select sum(verified_quantity) from snapshots where metric_key='local_owners'),0),
  'missionsCompleted',ordinary.completed,
  'moneyInvested',ordinary.invested,
  'volunteerHours',ordinary.hours,
  'skillsContributed',ordinary.skills,
  'organizationsInvolved',ordinary.orgs,
  'sdgMetrics',ordinary.sdgs,
  'communityData',ordinary.data_count,
  'verifiedResults',ordinary.verified)
 from ordinary
$$;
revoke all on function public.pr43_impact_rollup(uuid,uuid,uuid,uuid) from public;
grant execute on function public.pr43_impact_rollup(uuid,uuid,uuid,uuid) to authenticated;


-- Aluna can invalidate a mistaken verification without deleting the audit trail.
-- All old attestations remain with revoked_at, and the result can be reviewed again.
create or replace function public.pr43_revoke_result(p_result uuid,p_actor uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.pr43_contribution_results%rowtype;
begin
 if auth.uid() is null or not public.can_act_as(p_actor) or not public.is_aluna_admin() then
  raise exception 'Authorized Aluna administrator required';
 end if;
 if char_length(trim(coalesce(p_reason,''))) not between 10 and 2000 then
  raise exception 'Correction reason must be provided';
 end if;
 select * into r from public.pr43_contribution_results where id=p_result for update;
 if not found or r.verification_level<1 then raise exception 'No active verification exists'; end if;
 update public.pr43_contribution_reviews set revoked_at=now()
  where result_id=p_result and revoked_at is null;
 update public.pr43_contribution_results
  set verification_level=0,verified_quantity=null where id=p_result;
 if r.proof_id is not null then
  update public.proofs set verification_level=1 where id=r.proof_id;
  if r.verification_level>1 then
   insert into public.proof_verification_events
     (proof_id,previous_level,new_level,verifier_actor_id,verifier_profile_id,method,reason)
   values(r.proof_id,r.verification_level,1,p_actor,auth.uid(),'partner_review',trim(p_reason));
  end if;
 end if;
end $$;
revoke all on function public.pr43_revoke_result(uuid,uuid,text) from public;
grant execute on function public.pr43_revoke_result(uuid,uuid,text) to authenticated;
