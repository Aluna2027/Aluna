-- PR #50 follow-up: versioned First 340 applications and Super Admin-only review.
-- Existing application and audit rows remain intact; no historical row is made invalid.
begin;

alter table public.first340_applications
  add column if not exists application_version integer not null default 1,
  add column if not exists contact_email text,
  add column if not exists phone_e164 text,
  add column if not exists phone_country_code text;

alter table public.first340_applications
  drop constraint if exists first340_applications_profile_id_key;

create unique index if not exists first340_applications_profile_version_uidx
  on public.first340_applications(profile_id, application_version);

-- Only one non-withdrawn version can be active for a profile. Historical withdrawn
-- versions remain queryable and are never overwritten by reapplication.
create unique index if not exists first340_applications_one_active_per_profile_uidx
  on public.first340_applications(profile_id)
  where status <> 'withdrawn';

alter table public.first340_applications
  add constraint first340_applications_version_positive
  check (application_version > 0);
alter table public.first340_applications
  add constraint first340_applications_contact_email_length
  check (contact_email is null or char_length(contact_email)<=320);
alter table public.first340_applications
  add constraint first340_applications_phone_e164_format
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

create or replace function public.pr50_first340_supported_phone_country(p_code text)
returns boolean language sql immutable security invoker set search_path='' as $$
  select p_code=any(array['AC','AD','AE','AF','AG','AI','AL','AM','AO','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GT','GU','GW','GY','HK','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TA','TC','TD','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','XK','YE','YT','ZA','ZM','ZW']::text[])
$$;
revoke all on function public.pr50_first340_supported_phone_country(text) from public,anon,authenticated;

drop policy if exists "Read own or admin applications" on public.first340_applications;
drop policy if exists "Create own first 340 application" on public.first340_applications;
drop policy if exists "Edit own draft application" on public.first340_applications;
drop policy if exists "Read assigned team membership" on public.first340_team_members;
drop policy if exists "Read application audit" on public.first340_audit;

create policy "Read own or super admin applications"
  on public.first340_applications for select to authenticated
  using (profile_id=auth.uid() or public.is_aluna_super_admin());
create policy "Create own draft through trusted RPC"
  on public.first340_applications for insert to authenticated
  with check (profile_id=auth.uid() and status='draft' and submitted_at is null);
create policy "Edit own draft application"
  on public.first340_applications for update to authenticated
  using (profile_id=auth.uid() and status='draft')
  with check (profile_id=auth.uid() and status='draft');
create policy "Read assigned team membership"
  on public.first340_team_members for select to authenticated
  using (public.is_aluna_super_admin() or exists(
    select 1 from public.first340_applications a
    where a.id=application_id and a.profile_id=auth.uid()));
create policy "Read application audit"
  on public.first340_audit for select to authenticated
  using (public.is_aluna_super_admin() or exists(
    select 1 from public.first340_applications a
    where a.id=application_id and a.profile_id=auth.uid()));

revoke insert on public.first340_applications from anon, authenticated;
revoke update on public.first340_applications from authenticated;
grant update(motivation,country,languages,skills,expertise,relevant_experience,availability,
  preferred_role,travel_availability,additional_information,contact_email,phone_e164,
  phone_country_code,updated_at)
  on public.first340_applications to authenticated;

create or replace function public.start_first340_application()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_profile uuid := auth.uid(); v_id uuid; v_status text;
begin
  if v_profile is null then raise exception 'Authentication required'; end if;
  perform 1 from public.profiles p where p.id=v_profile for update;
  select a.id,a.status into v_id,v_status
    from public.first340_applications a
    where a.profile_id=v_profile and a.status<>'withdrawn'
    order by a.application_version desc limit 1;
  if v_id is not null then
    if v_status='draft' then return v_id; end if;
    raise exception 'An active application already exists';
  end if;
  insert into public.first340_applications(profile_id,application_version,status)
    values(v_profile,coalesce((select max(a.application_version)+1 from public.first340_applications a where a.profile_id=v_profile),1),'draft')
    returning id into v_id;
  insert into public.first340_audit(application_id,actor_profile_id,new_status,note)
    values(v_id,v_profile,'draft','Applicant started an application');
  return v_id;
end $$;

create or replace function public.reapply_first340_application()
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_profile uuid := auth.uid();
  v_id uuid;
  v_source public.first340_applications%rowtype;
begin
  if v_profile is null then raise exception 'Authentication required'; end if;
  perform 1 from public.profiles p where p.id=v_profile for update;
  if exists(select 1 from public.first340_applications a
      where a.profile_id=v_profile and a.status<>'withdrawn') then
    raise exception 'An active application already exists';
  end if;
  select * into v_source from public.first340_applications a
    where a.profile_id=v_profile and a.status='withdrawn'
    order by a.application_version desc limit 1;
  if not found then raise exception 'No withdrawn application exists'; end if;
  insert into public.first340_applications(
    profile_id,application_version,motivation,country,languages,skills,expertise,
    relevant_experience,availability,preferred_role,travel_availability,
    additional_information,contact_email,phone_e164,phone_country_code,status
  )
  values(
    v_profile,
    (select coalesce(max(a.application_version),0)+1 from public.first340_applications a where a.profile_id=v_profile),
    v_source.motivation,v_source.country,v_source.languages,v_source.skills,v_source.expertise,
    v_source.relevant_experience,v_source.availability,v_source.preferred_role,
    v_source.travel_availability,v_source.additional_information,v_source.contact_email,
    v_source.phone_e164,v_source.phone_country_code,'draft'
  ) returning id into v_id;
  insert into public.first340_audit(application_id,actor_profile_id,new_status,note)
    values(v_id,v_profile,'draft','Applicant started a new application version');
  return v_id;
end $$;

create or replace function public.submit_first340_application(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a public.first340_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into a from public.first340_applications
    where id=p_id and profile_id=auth.uid() for update;
  if not found or a.status<>'draft' then raise exception 'Application unavailable'; end if;
  if char_length(btrim(a.motivation))<10
    or char_length(btrim(a.country))=0
    or cardinality(array_remove(array(select btrim(item) from unnest(a.languages) as items(item)),''))=0
    or cardinality(array_remove(array(select btrim(item) from unnest(a.skills) as items(item)),''))=0
    or char_length(btrim(coalesce(a.expertise,'')))=0
    or char_length(btrim(coalesce(a.relevant_experience,'')))=0
    or char_length(btrim(coalesce(a.availability,'')))=0
    or char_length(btrim(coalesce(a.preferred_role,'')))=0
    or char_length(btrim(coalesce(a.travel_availability,'')))=0
    or char_length(btrim(coalesce(a.additional_information,'')))=0
    or char_length(btrim(coalesce(a.contact_email,'')))=0
    or lower(btrim(a.contact_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or coalesce(a.phone_e164,'') !~ '^\+[1-9][0-9]{7,14}$'
    or not public.pr50_first340_supported_phone_country(a.phone_country_code)
  then raise exception 'Complete all required application fields'; end if;
  update public.first340_applications
    set contact_email=lower(btrim(a.contact_email)),status='submitted',
        submitted_at=now(),updated_at=now()
    where id=p_id;
  insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,note)
    values(p_id,auth.uid(),'draft','submitted','Applicant submitted their application');
end $$;

create or replace function public.withdraw_first340_application(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_old text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select status into v_old from public.first340_applications
    where id=p_id and profile_id=auth.uid() for update;
  if v_old is null or v_old in ('selected','withdrawn') then
    raise exception 'Withdrawal unavailable';
  end if;
  delete from public.first340_team_members where application_id=p_id;
  update public.first340_applications
    set status='withdrawn',selected_at=null,updated_at=now() where id=p_id;
  insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,note)
    values(p_id,auth.uid(),v_old,'withdrawn','Applicant withdrew their application');
end $$;

create or replace function public.admin_first340_decision(
  p_id uuid,p_status text,p_team uuid default null,p_note text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare v_old text; v_old_team uuid; v_capacity integer; v_count integer;
begin
  if auth.uid() is null or not public.is_aluna_super_admin() then raise exception 'Not permitted'; end if;
  if p_status not in ('under_review','candidate','waitlisted','selected','not_selected') then raise exception 'Invalid status'; end if;
  if char_length(coalesce(p_note,''))>2000 then raise exception 'Note too long'; end if;
  select status into v_old from public.first340_applications where id=p_id for update;
  if v_old is null or v_old in ('withdrawn','draft') then raise exception 'Application unavailable'; end if;
  select team_id into v_old_team from public.first340_team_members where application_id=p_id;
  if p_team is not null and p_status<>'selected' then raise exception 'Only selected applicants may join a team'; end if;
  if p_status='selected' and p_team is not null and p_team is distinct from v_old_team then
    select capacity into v_capacity from public.first340_teams where id=p_team for update;
    if v_capacity is null then raise exception 'Team unavailable'; end if;
    select count(*) into v_count from public.first340_team_members where team_id=p_team;
    if v_count>=v_capacity then raise exception 'Team is full'; end if;
  end if;
  if p_status<>'selected' then delete from public.first340_team_members where application_id=p_id; end if;
  update public.first340_applications set status=p_status,reviewed_at=now(),
    selected_at=case when p_status='selected' then coalesce(selected_at,now()) else null end,
    updated_at=now() where id=p_id;
  if p_team is not null then
    insert into public.first340_team_members(application_id,team_id,assigned_by)
      values(p_id,p_team,auth.uid())
      on conflict(application_id) do update set team_id=excluded.team_id,assigned_by=excluded.assigned_by,assigned_at=now();
  end if;
  if v_old is distinct from p_status or v_old_team is distinct from
    (case when p_status='selected' then coalesce(p_team,v_old_team) else null end) then
    insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,previous_team_id,new_team_id,note)
      values(p_id,auth.uid(),v_old,p_status,v_old_team,
        case when p_status='selected' then coalesce(p_team,v_old_team) else null end,coalesce(p_note,''));
  end if;
end $$;

create or replace function public.first340_candidate_activity(p_profile uuid)
returns table(amount_raised numeric,donors_recruited bigint,referral_clicks bigint,conversions bigint,
  contributions bigint,skills_contributed bigint,time_contributed numeric,work_contributed bigint)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;
begin
  if auth.uid() is null or not public.is_aluna_super_admin() then raise exception 'Not permitted'; end if;
  select id into v_actor from public.actors where profile_id=p_profile;
  return query select
    coalesce((select sum(d.amount-d.refunded_amount) from public.fundraiser_donations d join public.fundraisers f on f.id=d.fundraiser_id where f.actor_id=v_actor and d.currency_code='EUR'),0),
    coalesce((select count(distinct d.donor_reference) from public.fundraiser_donations d join public.fundraisers f on f.id=d.fundraiser_id where f.actor_id=v_actor),0),
    coalesce((select sum(r.clicks) from public.referral_source_counts r join public.fundraiser_referral_links l on l.id=r.referral_link_id join public.fundraisers f on f.id=l.fundraiser_id where f.actor_id=v_actor),0)::bigint,
    coalesce((select count(*) from public.fundraisers f where f.actor_id=v_actor and f.referred_by_link_id is not null),0),
    coalesce((select count(*) from public.contributions c where c.actor_id=v_actor),0),
    coalesce((select count(*) from public.contributions c where c.actor_id=v_actor and c.contribution_type='skills'),0),
    coalesce((select sum(c.quantity) from public.contributions c where c.actor_id=v_actor and c.contribution_type='time' and c.quantity_unit='hours'),0),
    coalesce((select count(*) from public.contributions c where c.actor_id=v_actor and c.contribution_type='work'),0);
end $$;

create or replace function public.first340_candidate_breakdown(p_profile uuid)
returns table(campaigns bigint,attributed_donations bigint,contribution_types jsonb)
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid;
begin
  if auth.uid() is null or not public.is_aluna_super_admin() then raise exception 'Not permitted'; end if;
  select id into v_actor from public.actors where profile_id=p_profile;
  return query select
    (select count(distinct f.campaign_id) from public.fundraisers f where f.actor_id=v_actor),
    (select count(*) from public.fundraiser_donations d join public.fundraiser_referral_links l on l.id=d.referral_link_id join public.fundraisers f on f.id=l.fundraiser_id where f.actor_id=v_actor and d.amount>d.refunded_amount),
    (select coalesce(jsonb_object_agg(t.contribution_type,t.total),'{}'::jsonb)
      from (select c.contribution_type,count(*) as total from public.contributions c where c.actor_id=v_actor group by c.contribution_type) t);
end $$;

create or replace function public.first340_admin_application_page(
  p_search text default null,p_status text default null,p_country text default null,
  p_submitted_from date default null,p_submitted_to date default null,
  p_limit integer default 25,p_offset integer default 0
)
returns table(profile_id uuid,display_name text,username text,contact_email text,phone_e164 text,
  phone_country_code text,country text,latest_status text,latest_submitted_at timestamptz,
  latest_activity_at timestamptz,latest_application_id uuid,current_draft_id uuid,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_aluna_super_admin() then raise exception 'Not permitted'; end if;
  return query
    with latest as (
      select distinct on (a.profile_id) a.*
      from public.first340_applications a
      order by a.profile_id,a.application_version desc,a.created_at desc
    ), submitted as (
      select distinct on (a.profile_id) a.*
      from public.first340_applications a
      where a.submitted_at is not null
      order by a.profile_id,a.submitted_at desc,a.application_version desc
    ), drafts as (
      select distinct on (a.profile_id) a.*
      from public.first340_applications a
      where a.status='draft'
      order by a.profile_id,a.updated_at desc,a.application_version desc
    ), people as (
      select a.profile_id as pid,
        pp.display_name,
        nullif(u.raw_user_meta_data->>'username','') as uname,
        coalesce(d.contact_email,a.contact_email,s.contact_email) as email,
        lower(u.email) as account_email,
        coalesce(d.phone_e164,a.phone_e164,s.phone_e164) as phone,
        coalesce(d.phone_country_code,a.phone_country_code,s.phone_country_code) as phone_cc,
        coalesce(d.country,a.country,s.country) as app_country,
        a.status as app_status,
        s.submitted_at as submitted_at,
        greatest(coalesce(a.updated_at,'-infinity'::timestamptz),coalesce(s.updated_at,'-infinity'::timestamptz),coalesce(d.updated_at,'-infinity'::timestamptz)) as activity_at,
        a.id as submitted_id,d.id as draft_id
      from latest a
      left join submitted s on s.profile_id=a.profile_id
      left join drafts d on d.profile_id=a.profile_id
      join public.profiles p on p.id=a.profile_id
      left join public.public_profiles pp on pp.id=p.id
      left join auth.users u on u.id=p.id
    ), filtered as (
      select * from people x
      where (nullif(btrim(p_search),'') is null or
        concat_ws(' ',x.display_name,x.uname,x.email,x.account_email,x.pid::text) ilike '%'||btrim(p_search)||'%')
        and (nullif(p_status,'') is null or x.app_status=p_status)
        and (nullif(btrim(p_country),'') is null or x.app_country ilike '%'||btrim(p_country)||'%')
        and (p_submitted_from is null or x.submitted_at::date>=p_submitted_from)
        and (p_submitted_to is null or x.submitted_at::date<=p_submitted_to)
    )
    select x.pid,x.display_name,x.uname,x.email,x.phone,x.phone_cc,x.app_country,
      x.app_status,x.submitted_at,x.activity_at,x.submitted_id,x.draft_id,
      count(*) over()::bigint
    from filtered x
    order by x.submitted_at desc nulls last,x.activity_at desc,x.pid
    limit least(greatest(coalesce(p_limit,25),1),100)
    offset greatest(coalesce(p_offset,0),0);
end $$;

revoke all on function public.start_first340_application() from public,anon;
revoke all on function public.reapply_first340_application() from public,anon;
revoke all on function public.submit_first340_application(uuid) from public,anon;
revoke all on function public.withdraw_first340_application(uuid) from public,anon;
revoke all on function public.admin_first340_decision(uuid,text,uuid,text) from public,anon;
revoke all on function public.first340_candidate_activity(uuid) from public,anon;
revoke all on function public.first340_candidate_breakdown(uuid) from public,anon;
revoke all on function public.first340_admin_application_page(text,text,text,date,date,integer,integer) from public,anon;
grant execute on function public.start_first340_application() to authenticated;
grant execute on function public.reapply_first340_application() to authenticated;
grant execute on function public.submit_first340_application(uuid) to authenticated;
grant execute on function public.withdraw_first340_application(uuid) to authenticated;
grant execute on function public.admin_first340_decision(uuid,text,uuid,text) to authenticated;
grant execute on function public.first340_candidate_activity(uuid) to authenticated;
grant execute on function public.first340_candidate_breakdown(uuid) to authenticated;
grant execute on function public.first340_admin_application_page(text,text,text,date,date,integer,integer) to authenticated;

commit;
