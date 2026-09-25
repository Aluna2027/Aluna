-- Phase 14: The First 340 is a program status on the existing Aluna account.
create table public.aluna_admins(profile_id uuid primary key references public.profiles(id) on delete cascade, granted_at timestamptz not null default now());
alter table public.aluna_admins enable row level security;
revoke all on public.aluna_admins from anon,authenticated;
create table public.first340_teams(id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 2 and 120), description text, capacity integer not null default 20 check(capacity between 1 and 100), created_at timestamptz not null default now());
alter table public.first340_teams enable row level security;
create policy "Read first 340 teams" on public.first340_teams for select to authenticated using(true);
create table public.first340_applications(
 id uuid primary key default gen_random_uuid(), profile_id uuid not null unique references public.profiles(id) on delete cascade,
 motivation text not null default '' check(char_length(motivation)<=5000), country text not null default '' check(char_length(country)<=120), languages text[] not null default '{}', skills text[] not null default '{}', expertise text check(expertise is null or char_length(expertise)<=3000), relevant_experience text check(relevant_experience is null or char_length(relevant_experience)<=5000), availability text check(availability is null or char_length(availability)<=1000), preferred_role text check(preferred_role is null or char_length(preferred_role)<=500), travel_availability text check(travel_availability is null or char_length(travel_availability)<=1000), additional_information text check(additional_information is null or char_length(additional_information)<=5000), status text not null default 'draft' check(status in ('draft','submitted','under_review','candidate','waitlisted','selected','not_selected','withdrawn')),
 submitted_at timestamptz, reviewed_at timestamptz, selected_at timestamptz, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index first340_applications_status_idx on public.first340_applications(status,updated_at desc);
create table public.first340_team_members(application_id uuid primary key references public.first340_applications(id) on delete cascade, team_id uuid not null references public.first340_teams(id) on delete restrict, assigned_at timestamptz not null default now(), assigned_by uuid not null references public.profiles(id));
create table public.first340_audit(id uuid primary key default gen_random_uuid(), application_id uuid not null references public.first340_applications(id) on delete restrict, actor_profile_id uuid not null references public.profiles(id) on delete restrict, previous_status text, new_status text, previous_team_id uuid references public.first340_teams(id), new_team_id uuid references public.first340_teams(id), note text not null default '' check(char_length(note)<=2000), created_at timestamptz not null default now());
create index first340_audit_application_idx on public.first340_audit(application_id,created_at desc);
alter table public.first340_applications enable row level security; alter table public.first340_team_members enable row level security; alter table public.first340_audit enable row level security;
create function public.is_aluna_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.aluna_admins where profile_id=auth.uid()) $$;
revoke all on function public.is_aluna_admin() from public; grant execute on function public.is_aluna_admin() to authenticated;
create policy "Read own or admin applications" on public.first340_applications for select to authenticated using(profile_id=auth.uid() or public.is_aluna_admin());
create policy "Create own first 340 application" on public.first340_applications for insert to authenticated with check(profile_id=auth.uid() and status='draft' and submitted_at is null and reviewed_at is null and selected_at is null);
create policy "Edit own draft application" on public.first340_applications for update to authenticated using(profile_id=auth.uid() and status='draft') with check(profile_id=auth.uid() and status='draft');
revoke update on public.first340_applications from authenticated;
grant update(motivation,country,languages,skills,expertise,relevant_experience,availability,preferred_role,travel_availability,additional_information,updated_at) on public.first340_applications to authenticated;
create policy "Read assigned team membership" on public.first340_team_members for select to authenticated using(public.is_aluna_admin() or exists(select 1 from public.first340_applications a where a.id=application_id and a.profile_id=auth.uid()));
create policy "Read application audit" on public.first340_audit for select to authenticated using(public.is_aluna_admin() or exists(select 1 from public.first340_applications a where a.id=application_id and a.profile_id=auth.uid()));
revoke insert,update,delete on public.first340_team_members,public.first340_audit from anon,authenticated;
create function public.submit_first340_application(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_old text;
begin
 select status into v_old from public.first340_applications where id=p_id and profile_id=auth.uid() for update;
 if v_old is distinct from 'draft' then raise exception 'Application unavailable'; end if;
 update public.first340_applications set status='submitted',submitted_at=now(),updated_at=now() where id=p_id;
 insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,note) values(p_id,auth.uid(),'draft','submitted','Applicant submitted their application');
end $$;
create function public.withdraw_first340_application(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_old text;
begin
 select status into v_old from public.first340_applications where id=p_id and profile_id=auth.uid() for update;
 if v_old is null or v_old in ('selected','withdrawn') then raise exception 'Withdrawal unavailable'; end if;
 delete from public.first340_team_members where application_id=p_id;
 update public.first340_applications set status='withdrawn',selected_at=null,updated_at=now() where id=p_id;
 insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,note) values(p_id,auth.uid(),v_old,'withdrawn','Applicant withdrew their application');
end $$;
create function public.admin_first340_decision(p_id uuid,p_status text,p_team uuid default null,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare v_old text; v_old_team uuid; v_capacity integer; v_count integer;
begin
 if not public.is_aluna_admin() then raise exception 'Not permitted'; end if;
 if p_status not in ('under_review','candidate','waitlisted','selected','not_selected') then raise exception 'Invalid status'; end if;
 if char_length(coalesce(p_note,''))>2000 then raise exception 'Note too long'; end if;
 select status into v_old from public.first340_applications where id=p_id for update;
 if v_old is null or v_old='withdrawn' then raise exception 'Application unavailable'; end if;
 if v_old='draft' then raise exception 'Application has not been submitted'; end if;
 select team_id into v_old_team from public.first340_team_members where application_id=p_id;
 if p_team is not null and p_status<>'selected' then raise exception 'Only selected applicants may join a team'; end if;
 if p_status='selected' and p_team is not null and p_team is distinct from v_old_team then
  select capacity into v_capacity from public.first340_teams where id=p_team for update;
  if v_capacity is null then raise exception 'Team unavailable'; end if;
  select count(*) into v_count from public.first340_team_members where team_id=p_team;
  if v_count>=v_capacity then raise exception 'Team is full'; end if;
 end if;
 if p_status<>'selected' then delete from public.first340_team_members where application_id=p_id; end if;
 update public.first340_applications set status=p_status,reviewed_at=now(),selected_at=case when p_status='selected' then coalesce(selected_at,now()) else null end,updated_at=now() where id=p_id;
 if p_team is not null then insert into public.first340_team_members(application_id,team_id,assigned_by) values(p_id,p_team,auth.uid()) on conflict(application_id) do update set team_id=excluded.team_id,assigned_by=excluded.assigned_by,assigned_at=now(); end if;
 if v_old is distinct from p_status or v_old_team is distinct from (case when p_status='selected' then coalesce(p_team,v_old_team) else null end) then
  insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,previous_team_id,new_team_id,note) values(p_id,auth.uid(),v_old,p_status,v_old_team,case when p_status='selected' then coalesce(p_team,v_old_team) else null end,coalesce(p_note,''));
 end if;
end $$;
revoke all on function public.submit_first340_application(uuid),public.admin_first340_decision(uuid,text,uuid,text) from public; grant execute on function public.submit_first340_application(uuid) to authenticated; grant execute on function public.admin_first340_decision(uuid,text,uuid,text) to authenticated;
revoke all on function public.withdraw_first340_application(uuid) from public; grant execute on function public.withdraw_first340_application(uuid) to authenticated;
create function public.first340_candidate_activity(p_profile uuid) returns table(amount_raised numeric,donors_recruited bigint,referral_clicks bigint,conversions bigint,contributions bigint,skills_contributed bigint,time_contributed numeric,work_contributed bigint) language plpgsql security definer set search_path='' as $$ declare v_actor uuid; begin if not public.is_aluna_admin() then raise exception 'Not permitted'; end if; select id into v_actor from public.actors where profile_id=p_profile; return query select coalesce((select sum(d.amount-d.refunded_amount) from public.fundraiser_donations d join public.fundraisers f on f.id=d.fundraiser_id where f.actor_id=v_actor and d.currency_code='EUR'),0),coalesce((select count(distinct d.donor_reference) from public.fundraiser_donations d join public.fundraisers f on f.id=d.fundraiser_id where f.actor_id=v_actor),0),coalesce((select sum(r.clicks) from public.referral_source_counts r join public.fundraiser_referral_links l on l.id=r.referral_link_id join public.fundraisers f on f.id=l.fundraiser_id where f.actor_id=v_actor),0)::bigint,coalesce((select count(*) from public.fundraisers f where f.actor_id=v_actor and f.referred_by_link_id is not null),0),coalesce((select count(*) from public.contributions c where c.actor_id=v_actor),0),coalesce((select count(*) from public.contributions c where c.actor_id=v_actor and c.contribution_type='skills'),0),coalesce((select sum(c.quantity) from public.contributions c where c.actor_id=v_actor and c.contribution_type='time' and c.quantity_unit='hours'),0),coalesce((select count(*) from public.contributions c where c.actor_id=v_actor and c.contribution_type='work'),0); end $$;
revoke all on function public.first340_candidate_activity(uuid) from public; grant execute on function public.first340_candidate_activity(uuid) to authenticated;
create function public.first340_candidate_breakdown(p_profile uuid)
returns table(campaigns bigint,attributed_donations bigint,contribution_types jsonb)
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid;
begin
 if not public.is_aluna_admin() then raise exception 'Not permitted'; end if;
 select id into v_actor from public.actors where profile_id=p_profile;
 return query select
  (select count(distinct f.campaign_id) from public.fundraisers f where f.actor_id=v_actor),
  (select count(*) from public.fundraiser_donations d join public.fundraiser_referral_links l on l.id=d.referral_link_id join public.fundraisers f on f.id=l.fundraiser_id where f.actor_id=v_actor and d.amount>d.refunded_amount),
  (select coalesce(jsonb_object_agg(t.contribution_type,t.total),'{}'::jsonb) from (select c.contribution_type,count(*) as total from public.contributions c where c.actor_id=v_actor group by c.contribution_type) t);
end $$;
revoke all on function public.first340_candidate_breakdown(uuid) from public;
grant execute on function public.first340_candidate_breakdown(uuid) to authenticated;
