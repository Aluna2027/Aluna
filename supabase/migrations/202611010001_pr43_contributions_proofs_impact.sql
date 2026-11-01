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
 metric_key text not null check (metric_key in ('people_connected','nodes_installed','local_owners','money_invested','volunteer_hours','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed')),
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
create unique index if not exists pr43_result_unique_reference on public.pr43_contribution_results(metric_key,source_reference) where source_reference is not null;

create table if not exists public.pr43_contribution_reviews (
 id uuid primary key default gen_random_uuid(),
 result_id uuid not null references public.pr43_contribution_results(id) on delete restrict,
 reviewer_actor_id uuid not null references public.actors(id) on delete restrict,
 reviewer_profile_id uuid not null references public.profiles(id) on delete restrict,
 role text not null check (role in ('owner','organization','aluna')),
 confirmed_quantity numeric(18,2) not null check (confirmed_quantity >= 0 and confirmed_quantity <= 1000000000),
 impact_result text,
 reviewed_at timestamptz not null default now(),
 unique(result_id,role)
);
create index if not exists pr43_reviews_result_idx on public.pr43_contribution_reviews(result_id);

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
create policy "PR43 read attachments" on public.pr43_contribution_files for select to authenticated using(true);
create policy "PR43 save attachments" on public.pr43_contribution_files for insert to authenticated
 with check (exists(select 1 from public.contributions c where c.id=contribution_id and public.can_act_as(c.actor_id)));
revoke all on public.pr43_contribution_results,public.pr43_contribution_reviews from anon,authenticated;
grant select on public.pr43_contribution_results,public.pr43_contribution_reviews to authenticated;
revoke all on public.pr43_contribution_files from anon,authenticated;
grant select,insert on public.pr43_contribution_files to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('contribution-evidence','contribution-evidence',false,20971520,
 array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
 on conflict(id) do nothing;
create policy "PR43 evidence read" on storage.objects for select to authenticated using(bucket_id='contribution-evidence');
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
  if jsonb_typeof(entry->'metrics')<>'array' then raise exception 'Measurements required'; end if;
  if jsonb_array_length(entry->'metrics')=0 then raise exception 'At least one result is required'; end if;
  for result in select value from jsonb_array_elements(entry->'metrics') loop
   key:=result->>'key';
   if key not in ('people_connected','nodes_installed','local_owners','money_invested','volunteer_hours','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed')
    or coalesce(result->>'quantity','') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Invalid metric'; end if;
   amount:=(result->>'quantity')::numeric;
   if amount<0 or amount>1000000000 then raise exception 'Metric outside allowed range'; end if;
   if (t='time' and key<>'volunteer_hours') or
      (t='skills' and key<>'skills_contributed') or
      (t='complete_sdg_mission' and key<>'mission_completed') or
      (t='complete_wifi_community' and key<>'wifi_completed') or
      (t='data' and key not in ('people_connected','nodes_installed','local_owners','money_invested','sdg_metrics','community_data')) or
      (t not in ('time','skills','data','complete_sdg_mission','complete_wifi_community') and key not in ('community_data')) then
      raise exception 'Metric not allowed for this contribution type';
   end if;
   unit_name:=coalesce(nullif(result->>'unit',''),'count');
   src:=nullif(trim(result->>'reference'),'');
   indicator_name:=nullif(trim(result->>'indicator'),'');
   select coalesce(array_agg(value::integer),'{}') into sdgs from jsonb_array_elements_text(coalesce(result->'sdgs','[]'::jsonb)) value;
   if key='sdg_metrics' and (indicator_name is null or cardinality(sdgs)=0) then raise exception 'SDG indicator and goals required'; end if;
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
declare r public.pr43_contribution_results%rowtype; contributor public.contributions%rowtype;
reviewer_org uuid; role_name text; owner_ok boolean; org_ok boolean; v_level smallint;
current_level smallint; v_proof uuid; partner_value numeric; grant_level smallint;
begin
 if auth.uid() is null or not public.can_act_as(p_actor) then raise exception 'Reviewer not authorized'; end if;
 select * into r from public.pr43_contribution_results where id=p_result for update;
 if not found then raise exception 'Result not found'; end if;
 select * into contributor from public.contributions where id=r.contribution_id;
 if p_value is null or p_value<0 or p_value>1000000000 then raise exception 'Invalid verified quantity'; end if;
 if p_value<>trunc(p_value) and r.metric_key in ('people_connected','nodes_installed','local_owners','skills_contributed','sdg_metrics','community_data','mission_completed','wifi_completed') then
  raise exception 'A whole number is required';
 end if;
 select organization_id into reviewer_org from public.actors where id=p_actor;
 select max_level into grant_level from public.proof_verifier_grants where profile_id=auth.uid();
 if coalesce(grant_level,0)>=4 and r.verification_level>=3 and p_actor<>contributor.actor_id then
   role_name:='aluna';
 elsif public.can_act_as(contributor.actor_id) then
   if p_actor<>contributor.actor_id then raise exception 'Confirm as the contributing actor'; end if;
   role_name:='owner';
 elsif reviewer_org is not null then
   if exists(select 1 from public.pr43_contribution_reviews x where x.result_id=p_result and x.role='owner' and x.reviewer_profile_id=auth.uid()) then
     raise exception 'Review must be independent'; end if;
   role_name:='organization';
 else raise exception 'Organization reviewer required'; end if;
 if role_name='organization' and exists(select 1 from public.pr43_contribution_reviews x where x.result_id=p_result and x.role='owner' and x.reviewer_profile_id=auth.uid()) then
  raise exception 'Independent review required';
 end if;
 if role_name='owner' and exists(select 1 from public.pr43_contribution_reviews x where x.result_id=p_result and x.role='organization' and x.reviewer_profile_id=auth.uid()) then
  raise exception 'Independent review required';
 end if;
 insert into public.pr43_contribution_reviews(result_id,reviewer_actor_id,reviewer_profile_id,role,confirmed_quantity,impact_result)
 values(p_result,p_actor,auth.uid(),role_name,p_value,nullif(trim(coalesce(p_impact_result,'')),''));
 select exists(select 1 from public.pr43_contribution_reviews where result_id=p_result and role='owner') into owner_ok;
 select exists(select 1 from public.pr43_contribution_reviews where result_id=p_result and role='organization') into org_ok;
 v_level:=case when role_name='aluna' then 4 when owner_ok and org_ok then 3 when org_ok then 2 else 1 end;
 current_level:=r.verification_level;
 if v_level<current_level then raise exception 'Cannot lower verification'; end if;
 if role_name='organization' then
  select confirmed_quantity into partner_value from public.pr43_contribution_reviews where result_id=p_result and role='organization';
 elsif role_name='aluna' then partner_value:=p_value;
 else
  select confirmed_quantity into partner_value from public.pr43_contribution_reviews where result_id=p_result and role='owner';
 end if;
 if v_level>=3 and partner_value is null then select confirmed_quantity into partner_value from public.pr43_contribution_reviews where result_id=p_result and role='organization'; end if;
 if r.proof_id is null then
  insert into public.proofs(actor_id,mission_id,city_id,contribution_id,evidence_type,evidence_description,result_text,occurred_on)
  values(contributor.actor_id,contributor.mission_id,contributor.city_id,contributor.id,'partner_confirmation',
   'Project contribution review with linked records and supporting attachments.',
   coalesce(nullif(trim(p_impact_result),''),contributor.title||' — reported project contribution'),current_date)
  returning id into v_proof;
  update public.pr43_contribution_results set proof_id=v_proof where id=p_result;
  insert into public.proof_verification_events(proof_id,previous_level,new_level,verifier_actor_id,verifier_profile_id,method,reason)
   values(v_proof,null,1,p_actor,auth.uid(),'self_report','PR43 contribution result registered for verification.');
 else v_proof:=r.proof_id;end if;
 if v_level>1 and v_level>greatest(1,current_level) then
  update public.proofs set verification_level=v_level where id=v_proof;
  insert into public.proof_verification_events(proof_id,previous_level,new_level,verifier_actor_id,verifier_profile_id,method,reason)
   values(v_proof,greatest(1,current_level),v_level,p_actor,auth.uid(),
    case when v_level=4 then 'ground_visit' else 'partner_review' end,
    'PR43 independent contribution verification (source-linked review).');
 end if;
 update public.pr43_contribution_results
  set verification_level=v_level,verified_quantity=case when v_level>=3 then partner_value else null end where id=p_result;
 return v_level;
end $$;
revoke all on function public.pr43_review_result(uuid,uuid,numeric,text) from public;
grant execute on function public.pr43_review_result(uuid,uuid,numeric,text) to authenticated;
