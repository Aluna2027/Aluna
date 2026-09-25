-- Phase 7: campaign and fundraiser content; only a trusted future payment flow may record donations.
create table public.fundraising_campaigns (
 id uuid primary key default gen_random_uuid(),
 mission_id uuid not null references public.missions(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete restrict,
 title text not null check(char_length(title) between 3 and 180),
 story text not null check(char_length(story) between 10 and 5000),
 goal_amount numeric(14,2) not null check(goal_amount>0),
 currency_code char(3) not null check(currency_code in ('EUR','USD','GBP')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index fundraising_campaigns_mission_idx on public.fundraising_campaigns(mission_id,created_at desc);
create function public.check_campaign_mission() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.missions m where m.id=new.mission_id and m.created_by_actor_id=new.actor_id) then
  raise exception 'Only the mission creator may create its campaign';
 end if;
 return new;
end $$;
create trigger campaign_mission_guard before insert on public.fundraising_campaigns for each row execute function public.check_campaign_mission();

create table public.fundraisers (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.fundraising_campaigns(id) on delete cascade,
 mission_id uuid not null references public.missions(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete restrict,
 kind text not null check(kind in ('personal','team')),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug)<=100),
 title text not null check(char_length(title) between 3 and 180),
 story text not null check(char_length(story) between 10 and 5000),
 goal_amount numeric(14,2) not null check(goal_amount>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index fundraisers_campaign_idx on public.fundraisers(campaign_id,created_at desc);
create index fundraisers_actor_idx on public.fundraisers(actor_id,created_at desc);
create index fundraisers_mission_idx on public.fundraisers(mission_id,created_at desc);
create function public.check_fundraiser_campaign() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.fundraising_campaigns c where c.id=new.campaign_id and c.mission_id=new.mission_id) then
  raise exception 'Fundraiser must belong to its campaign mission';
 end if;
 if not public.is_mission_participant(new.mission_id,new.actor_id) then raise exception 'Join the mission first'; end if;
 return new;
end $$;
create trigger fundraiser_campaign_guard before insert on public.fundraisers for each row execute function public.check_fundraiser_campaign();

create table public.fundraiser_team_members (
 fundraiser_id uuid not null references public.fundraisers(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(fundraiser_id,actor_id)
);
create index fundraiser_team_members_actor_idx on public.fundraiser_team_members(actor_id);
create function public.check_fundraiser_team() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.fundraisers f where f.id=new.fundraiser_id and f.kind='team' and public.is_mission_participant(f.mission_id,new.actor_id)) then
  raise exception 'Join the mission before joining its fundraising team';
 end if;
 return new;
end $$;
create trigger fundraiser_team_guard before insert on public.fundraiser_team_members for each row execute function public.check_fundraiser_team();

create table public.fundraiser_updates (
 id uuid primary key default gen_random_uuid(),
 fundraiser_id uuid not null references public.fundraisers(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete restrict,
 body text not null check(char_length(body) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index fundraiser_updates_recent_idx on public.fundraiser_updates(fundraiser_id,created_at desc,id desc);
create table public.fundraiser_comments (
 id uuid primary key default gen_random_uuid(),
 fundraiser_id uuid not null references public.fundraisers(id) on delete cascade,
 actor_id uuid not null references public.actors(id) on delete restrict,
 body text not null check(char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index fundraiser_comments_recent_idx on public.fundraiser_comments(fundraiser_id,created_at desc,id desc);

-- Prepared for a future verified payment webhook. The application cannot create or edit rows.
create table public.fundraiser_donations (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.fundraising_campaigns(id) on delete restrict,
 fundraiser_id uuid references public.fundraisers(id) on delete restrict,
 donor_reference text not null,
 amount numeric(14,2) not null check(amount>0),
 currency_code char(3) not null,
 provider_reference text not null unique,
 confirmed_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index fundraiser_donations_campaign_idx on public.fundraiser_donations(campaign_id,confirmed_at desc);
create index fundraiser_donations_fundraiser_idx on public.fundraiser_donations(fundraiser_id) where fundraiser_id is not null;
create function public.check_donation_campaign() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.fundraiser_id is not null and not exists(select 1 from public.fundraisers f where f.id=new.fundraiser_id and f.campaign_id=new.campaign_id) then
  raise exception 'Donation fundraiser and campaign mismatch';
 end if;
 if not exists(select 1 from public.fundraising_campaigns c where c.id=new.campaign_id and c.currency_code=new.currency_code) then
  raise exception 'Donation currency and campaign mismatch';
 end if;
 return new;
end $$;
create trigger donation_campaign_guard before insert on public.fundraiser_donations for each row execute function public.check_donation_campaign();
create function public.fundraising_totals(p_campaign uuid) returns table(fundraiser_id uuid,amount_raised numeric,donor_count bigint)
language sql stable security definer set search_path = '' as $$
 select d.fundraiser_id,coalesce(sum(d.amount),0),count(distinct d.donor_reference)
 from public.fundraiser_donations d where d.campaign_id=p_campaign group by grouping sets ((d.fundraiser_id),())
 having grouping(d.fundraiser_id)=1 or d.fundraiser_id is not null
$$;
revoke all on function public.fundraising_totals(uuid) from public;
grant execute on function public.fundraising_totals(uuid) to authenticated;

alter table public.fundraising_campaigns enable row level security;
alter table public.fundraisers enable row level security;
alter table public.fundraiser_team_members enable row level security;
alter table public.fundraiser_updates enable row level security;
alter table public.fundraiser_comments enable row level security;
alter table public.fundraiser_donations enable row level security;
create policy "View campaigns" on public.fundraising_campaigns for select to authenticated using(true);
create policy "Create own mission campaigns" on public.fundraising_campaigns for insert to authenticated with check(public.can_act_as(actor_id));
create policy "Edit own campaign" on public.fundraising_campaigns for update to authenticated using(public.can_act_as(actor_id)) with check(public.can_act_as(actor_id));
create policy "View fundraisers" on public.fundraisers for select to authenticated using(true);
create policy "Create owned fundraiser" on public.fundraisers for insert to authenticated with check(public.can_act_as(actor_id));
create policy "Edit owned fundraiser" on public.fundraisers for update to authenticated using(public.can_act_as(actor_id)) with check(public.can_act_as(actor_id));
create policy "View fundraising team" on public.fundraiser_team_members for select to authenticated using(true);
create policy "Join fundraising team" on public.fundraiser_team_members for insert to authenticated with check(public.can_act_as(actor_id));
create policy "Leave fundraising team" on public.fundraiser_team_members for delete to authenticated using(public.can_act_as(actor_id));
create policy "View fundraiser updates" on public.fundraiser_updates for select to authenticated using(true);
create policy "Post fundraiser update" on public.fundraiser_updates for insert to authenticated with check(public.can_act_as(actor_id) and exists(select 1 from public.fundraisers f where f.id=fundraiser_id and (f.actor_id=actor_id or exists(select 1 from public.fundraiser_team_members t where t.fundraiser_id=f.id and t.actor_id=actor_id))));
create policy "View fundraiser comments" on public.fundraiser_comments for select to authenticated using(true);
create policy "Comment on fundraiser" on public.fundraiser_comments for insert to authenticated with check(public.can_act_as(actor_id));
-- No donation policies: only trusted server-side payment integration may write donation facts.
revoke all on public.fundraiser_donations from anon,authenticated;
revoke update on public.fundraising_campaigns from authenticated;
grant update(title,story,goal_amount,updated_at) on public.fundraising_campaigns to authenticated;
revoke update on public.fundraisers from authenticated;
grant update(title,story,goal_amount,updated_at) on public.fundraisers to authenticated;
