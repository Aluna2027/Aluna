\set ON_ERROR_STOP on

-- Minimal isolated schema fixture for exercising the additive First 340 migration.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth,public to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;

create table public.profiles(id uuid primary key,display_name text);
create table public.public_profiles(id uuid primary key,display_name text,first_name text,last_name text);
create table public.aluna_admins(profile_id uuid primary key references public.profiles(id));
create table public.aluna_super_admins(profile_id uuid primary key references public.profiles(id));
create function public.is_aluna_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.aluna_admins a where a.profile_id=auth.uid())
$$;
create function public.is_aluna_super_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.aluna_super_admins a where a.profile_id=auth.uid())
$$;

create table public.first340_teams(
  id uuid primary key default gen_random_uuid(),name text not null,description text,
  capacity integer not null default 20,created_at timestamptz not null default now()
);
create table public.first340_applications(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  motivation text not null default '',country text not null default '',languages text[] not null default '{}',
  skills text[] not null default '{}',expertise text,relevant_experience text,availability text,
  preferred_role text,travel_availability text,additional_information text,
  status text not null default 'draft' check(status in ('draft','submitted','under_review','candidate','waitlisted','selected','not_selected','withdrawn')),
  submitted_at timestamptz,reviewed_at timestamptz,selected_at timestamptz,
  updated_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create table public.first340_team_members(
  application_id uuid primary key references public.first340_applications(id) on delete cascade,
  team_id uuid not null references public.first340_teams(id) on delete restrict,
  assigned_at timestamptz not null default now(),assigned_by uuid not null references public.profiles(id)
);
create table public.first340_audit(
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.first340_applications(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  previous_status text,new_status text,previous_team_id uuid references public.first340_teams(id),
  new_team_id uuid references public.first340_teams(id),note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.first340_applications enable row level security;
alter table public.first340_team_members enable row level security;
alter table public.first340_audit enable row level security;
create policy "Read own or admin applications" on public.first340_applications for select to authenticated
  using(profile_id=auth.uid() or public.is_aluna_admin());
create policy "Create own first 340 application" on public.first340_applications for insert to authenticated
  with check(profile_id=auth.uid() and status='draft');
create policy "Edit own draft application" on public.first340_applications for update to authenticated
  using(profile_id=auth.uid() and status='draft') with check(profile_id=auth.uid() and status='draft');
create policy "Read assigned team membership" on public.first340_team_members for select to authenticated
  using(public.is_aluna_admin() or exists(select 1 from public.first340_applications a where a.id=application_id and a.profile_id=auth.uid()));
create policy "Read application audit" on public.first340_audit for select to authenticated
  using(public.is_aluna_admin() or exists(select 1 from public.first340_applications a where a.id=application_id and a.profile_id=auth.uid()));
grant select,insert,update on public.first340_applications to authenticated;
grant select on public.first340_team_members,public.first340_audit,public.first340_teams to authenticated;

create table public.actors(id uuid primary key,profile_id uuid);
create table public.fundraisers(id uuid primary key,actor_id uuid,campaign_id uuid,referred_by_link_id uuid);
create table public.fundraiser_donations(
  id uuid primary key,fundraiser_id uuid,amount numeric,refunded_amount numeric,
  currency_code text,donor_reference text,referral_link_id uuid
);
create table public.fundraiser_referral_links(id uuid primary key,fundraiser_id uuid);
create table public.referral_source_counts(referral_link_id uuid,clicks bigint);
create table public.contributions(id uuid primary key,actor_id uuid,contribution_type text,quantity numeric,quantity_unit text);

insert into public.profiles(id,display_name) values
  ('10000000-0000-4000-8000-000000000001','Applicant One'),
  ('10000000-0000-4000-8000-000000000002','Ordinary Administrator'),
  ('10000000-0000-4000-8000-000000000003','Super Administrator'),
  ('10000000-0000-4000-8000-000000000004','New Applicant');
insert into public.public_profiles(id,display_name,first_name,last_name)
  select id,display_name,split_part(display_name,' ',1),split_part(display_name,' ',2) from public.profiles;
insert into auth.users(id,email,raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001','one@example.test','{"username":"applicant-one"}'),
  ('10000000-0000-4000-8000-000000000002','two@example.test','{"username":"ordinary-admin"}'),
  ('10000000-0000-4000-8000-000000000003','three@example.test','{"username":"super-admin"}'),
  ('10000000-0000-4000-8000-000000000004','four@example.test','{}');
insert into public.aluna_admins values('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
insert into public.aluna_super_admins values('10000000-0000-4000-8000-000000000003');
insert into public.first340_applications(
  profile_id,motivation,country,languages,skills,expertise,relevant_experience,availability,
  preferred_role,travel_availability,additional_information,status,submitted_at
) values(
  '10000000-0000-4000-8000-000000000001','Historical motivation','Netherlands',array['Dutch'],
  array['organizing'],'Past expertise','Past experience','Past availability','Past role',
  'Past travel','Past information','withdrawn','2026-01-10T10:00:00Z'
),(
  '10000000-0000-4000-8000-000000000002','Admin applicant motivation','Belgium',array['Dutch'],
  array['planning'],'Admin expertise','Admin experience','Weekly','Coordinator',
  'Local travel','Admin notes','submitted','2026-01-11T10:00:00Z'
);
insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,note)
  select id,profile_id,'submitted','withdrawn','Original audit remains' from public.first340_applications
  where profile_id='10000000-0000-4000-8000-000000000001';

\i supabase/migrations/20261123090000_pr50_first340_application_lifecycle.sql
\i supabase/migrations/20261124130000_pr50_first340_fixed_team_roster.sql

do $$
begin
  if (select count(*) from public.first340_applications)<>2 then raise exception 'Existing applications changed'; end if;
  if (select count(*) from public.first340_audit where note='Original audit remains')<>1 then raise exception 'Existing audit changed'; end if;
  if (select min(application_version) from public.first340_applications)<>1 then raise exception 'Historical version not defaulted to one'; end if;
end $$;

-- Ordinary applicants and ordinary Aluna admins see only their own rows and cannot call review APIs.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare n integer; v_new_id uuid;
begin
  select count(*) into n from public.first340_applications;
  if n<>1 then raise exception 'Applicant RLS exposed another dossier'; end if;
  v_new_id:=public.reapply_first340_application();
  if (select count(*) from public.first340_applications where profile_id=auth.uid())<>2 then raise exception 'Reapply did not create a second version'; end if;
  if not exists(select 1 from public.first340_applications a where a.id=v_new_id and a.application_version=2 and a.motivation='Historical motivation') then raise exception 'Reapply did not copy answers'; end if;
  if (select count(*) from public.first340_audit where application_id=(select a.id from public.first340_applications a where a.profile_id=auth.uid() and a.application_version=1))<>1 then raise exception 'Prior audit history changed'; end if;
  begin
    perform public.reapply_first340_application();
    raise exception 'Expected active application uniqueness rejection';
  exception when others then
    if sqlerrm='Expected active application uniqueness rejection' then raise; end if;
    if sqlerrm not like '%active application already exists%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
set role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.first340_applications;
  if n<>1 then raise exception 'Ordinary admin RLS exposed another dossier'; end if;
  begin
    perform * from public.first340_admin_application_page();
    raise exception 'Expected non-super-admin overview denial';
  exception when others then
    if sqlerrm='Expected non-super-admin overview denial' then raise; end if;
    if sqlerrm<>'Not permitted' then raise; end if;
  end;
  begin
    perform public.admin_first340_decision(
      (select id from public.first340_applications where profile_id=auth.uid()),'under_review',null,'');
    raise exception 'Expected non-super-admin decision denial';
  exception when others then
    if sqlerrm='Expected non-super-admin decision denial' then raise; end if;
    if sqlerrm<>'Not permitted' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
set role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.first340_applications;
  if n<>3 then raise exception 'Super Admin could not see all versioned applications'; end if;
  if (select count(distinct profile_id) from public.first340_admin_application_page())<>2 then raise exception 'Overview did not return one row per applicant'; end if;
  if not exists(select 1 from public.first340_admin_application_page(p_search=>'two@example.test') x
      where x.profile_id='10000000-0000-4000-8000-000000000002' and x.contact_email is null) then
    raise exception 'Account email search must not silently replace a historical application contact address';
  end if;
end $$;
reset role;

-- A new account can save an incomplete draft. Direct submit RPC still rejects it.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
set role authenticated;
do $$
declare v_new_id uuid;
begin
  v_new_id:=public.start_first340_application();
  begin
    perform public.submit_first340_application(v_new_id);
    raise exception 'Expected incomplete application rejection';
  exception when others then
    if sqlerrm='Expected incomplete application rejection' then raise; end if;
    if sqlerrm not like '%Complete all required application fields%' then raise; end if;
  end;
  update public.first340_applications set
    motivation='A complete motivation with sufficient detail.',
    country='United States',languages=array['English'],skills=array['Community work'],
    expertise='Community program design',relevant_experience='Organized local activities.',
    availability='Weekends',preferred_role='Coordinator',travel_availability='Domestic',
    additional_information='Available for the next cohort.',contact_email=' FOUR@EXAMPLE.TEST ',
    phone_e164='+12025550123',phone_country_code='ZZ'
  where first340_applications.id=v_new_id;
  begin
    perform public.submit_first340_application(v_new_id);
    raise exception 'Expected unsupported phone country rejection';
  exception when others then
    if sqlerrm='Expected unsupported phone country rejection' then raise; end if;
    if sqlerrm not like '%Complete all required application fields%' then raise; end if;
  end;
  update public.first340_applications set phone_country_code='US' where first340_applications.id=v_new_id;
  perform public.submit_first340_application(v_new_id);
  if not exists(select 1 from public.first340_applications a where a.id=v_new_id and a.status='submitted' and a.contact_email='four@example.test') then raise exception 'Valid submission did not normalize contact email'; end if;
end $$;
reset role;


-- The fixed roster is exactly 20 teams of 17, and schema constraints reject drift.
do $$
begin
  if (select count(*) from public.first340_teams)<>20 then raise exception 'Expected exactly 20 First 340 teams'; end if;
  if (select sum(capacity) from public.first340_teams)<>340 then raise exception 'Expected 340 total team places'; end if;
  if exists(select 1 from public.first340_teams where capacity<>17) then raise exception 'A team has a noncanonical capacity'; end if;
  if not has_table_privilege('authenticated','public.first340_teams','SELECT')
    or not has_table_privilege('authenticated','public.first340_team_members','SELECT') then
    raise exception 'Authenticated roster reads were not preserved';
  end if;
  if has_table_privilege('anon','public.first340_teams','TRUNCATE')
    or has_table_privilege('authenticated','public.first340_teams','TRUNCATE')
    or has_table_privilege('anon','public.first340_team_members','TRUNCATE')
    or has_table_privilege('authenticated','public.first340_team_members','TRUNCATE')
    or has_table_privilege('authenticated','public.first340_teams','INSERT')
    or has_table_privilege('authenticated','public.first340_team_members','INSERT') then
    raise exception 'Client roles retain direct team mutation privileges';
  end if;
  begin
    insert into public.first340_teams(name,capacity) values('Team 21',17);
    raise exception 'Expected fixed team-name constraint';
  exception when check_violation then null;
  end;
  begin
    update public.first340_teams set capacity=18 where name='Team 1';
    raise exception 'Expected fixed capacity constraint';
  exception when check_violation then null;
  end;
end $$;

-- Seed and assignment behavior: only Super Admin can assign, and team capacity is enforced.
insert into public.profiles(id,display_name)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Capacity Applicant '||n
from generate_series(1,18) as numbers(n);
insert into public.first340_applications(profile_id,status,submitted_at)
select id,'submitted',now() from public.profiles where display_name like 'Capacity Applicant %';

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
set role authenticated;
do $$
declare
  v_team uuid;
  v_application uuid;
  v_index integer:=0;
  rec record;
begin
  select id into v_team from public.first340_teams where name='Team 1';
  for rec in
    select a.id from public.first340_applications a
    where a.profile_id between '20000000-0000-4000-8000-000000000001'::uuid
      and '20000000-0000-4000-8000-000000000018'::uuid
    order by a.profile_id
  loop
    v_index:=v_index+1;
    if v_index<=17 then
      perform public.admin_first340_decision(rec.id,'selected',v_team,'Capacity integration test');
    else
      begin
        perform public.admin_first340_decision(rec.id,'selected',v_team,'Capacity integration test');
        raise exception 'Expected full-team assignment rejection';
      exception when others then
        if sqlerrm='Expected full-team assignment rejection' then raise; end if;
        if sqlerrm not like '%Team is full%' then raise; end if;
      end;
      if (select status from public.first340_applications where id=rec.id)<>'submitted'
        or exists(select 1 from public.first340_team_members where application_id=rec.id)
      then raise exception 'Failed full-team assignment changed application state'; end if;
    end if;
  end loop;
  if v_index<>18 then raise exception 'Capacity fixtures were not created'; end if;
  if (select count(*) from public.first340_team_members where team_id=v_team)<>17 then
    raise exception 'Team assignment exceeded or missed its capacity';
  end if;

  select a.id into v_application from public.first340_applications a
    where a.profile_id between '20000000-0000-4000-8000-000000000001'::uuid
      and '20000000-0000-4000-8000-000000000018'::uuid
    order by a.profile_id limit 1;
  begin
    perform public.admin_first340_decision(v_application,'candidate',v_team,'Invalid status/team combination');
    raise exception 'Expected non-selected assignment rejection';
  exception when others then
    if sqlerrm='Expected non-selected assignment rejection' then raise; end if;
    if sqlerrm not like '%Only selected applicants may join a team%' then raise; end if;
  end;
  if not exists(select 1 from public.first340_team_members where application_id=v_application and team_id=v_team) then
    raise exception 'Rejected status/team combination changed the assignment';
  end if;
  perform public.admin_first340_decision(v_application,'candidate',null,'Release team place');
  if exists(select 1 from public.first340_team_members where application_id=v_application) then
    raise exception 'Changing status away from Selected did not release the team place';
  end if;
  if not exists(select 1 from public.first340_audit where application_id=v_application and previous_team_id=v_team and new_team_id is null) then
    raise exception 'Team removal was not recorded in audit history';
  end if;

  select id into v_application from public.first340_applications where profile_id='10000000-0000-4000-8000-000000000002';
  begin
    perform public.admin_first340_decision(v_application,'selected',gen_random_uuid(),'Unavailable team');
    raise exception 'Expected unavailable team rejection';
  exception when others then
    if sqlerrm='Expected unavailable team rejection' then raise; end if;
    if sqlerrm not like '%Team unavailable%' then raise; end if;
  end;
end $$;
reset role;

-- Anonymous users cannot execute applicant or Super Admin APIs.
set role anon;
do $$
begin
  begin
    perform public.first340_admin_application_page();
    raise exception 'Expected anonymous access denial';
  exception when others then
    if sqlerrm='Expected anonymous access denial' then raise; end if;
    if sqlerrm not in ('permission denied for function first340_admin_application_page','Not permitted') then raise; end if;
  end;
end $$;
reset role;
