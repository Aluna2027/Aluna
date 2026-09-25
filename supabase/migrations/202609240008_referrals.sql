-- Phase 8: one shareable referral token per fundraiser; aggregate counts only.
create table public.fundraiser_referral_links (
 id uuid primary key default gen_random_uuid(),
 fundraiser_id uuid not null unique references public.fundraisers(id) on delete cascade,
 token text not null unique default md5(gen_random_uuid()::text || gen_random_uuid()::text) check(token ~ '^[a-f0-9]{32}$'),
 created_at timestamptz not null default now()
);
create index referral_links_token_idx on public.fundraiser_referral_links(token);
insert into public.fundraiser_referral_links(fundraiser_id) select id from public.fundraisers;
create function public.add_fundraiser_referral() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.fundraiser_referral_links(fundraiser_id) values(new.id); return new; end $$;
create trigger fundraiser_referral_created after insert on public.fundraisers for each row execute function public.add_fundraiser_referral();

create table public.referral_source_counts (
 referral_link_id uuid not null references public.fundraiser_referral_links(id) on delete cascade,
 source text not null check(source in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy')),
 clicks bigint not null default 0 check(clicks>=0),
 updated_at timestamptz not null default now(),
 primary key(referral_link_id,source)
);

alter table public.fundraisers add column referred_by_link_id uuid references public.fundraiser_referral_links(id) on delete restrict;
alter table public.fundraisers add column referred_by_source text check(referred_by_source is null or referred_by_source in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy'));
alter table public.fundraisers add constraint fundraiser_referral_pair check((referred_by_link_id is null)=(referred_by_source is null));
create index fundraisers_referrer_idx on public.fundraisers(referred_by_link_id,referred_by_source) where referred_by_link_id is not null;

alter table public.fundraiser_donations add column referral_link_id uuid references public.fundraiser_referral_links(id) on delete restrict;
alter table public.fundraiser_donations add column referral_source text check(referral_source is null or referral_source in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy'));
alter table public.fundraiser_donations add constraint donation_referral_pair check((referral_link_id is null)=(referral_source is null));
create index donations_referral_idx on public.fundraiser_donations(referral_link_id,referral_source) where referral_link_id is not null;
create function public.check_donation_referral() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.referral_link_id is not null and not exists(
  select 1 from public.fundraiser_referral_links l join public.fundraisers f on f.id=l.fundraiser_id
  where l.id=new.referral_link_id and f.campaign_id=new.campaign_id
 ) then raise exception 'Referral does not belong to this campaign'; end if;
 return new;
end $$;
create trigger donation_referral_guard before insert or update of referral_link_id,campaign_id on public.fundraiser_donations for each row execute function public.check_donation_referral();

create function public.visit_fundraiser_referral(p_token text,p_source text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_link uuid;v_slug text;
begin
 if p_source not in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy') then return null; end if;
 select l.id,f.slug into v_link,v_slug from public.fundraiser_referral_links l join public.fundraisers f on f.id=l.fundraiser_id where l.token=p_token;
 if v_link is null then return null; end if;
 insert into public.referral_source_counts(referral_link_id,source,clicks) values(v_link,p_source,1)
 on conflict(referral_link_id,source) do update set clicks=public.referral_source_counts.clicks+1,updated_at=now();
 return v_slug;
end $$;
revoke all on function public.visit_fundraiser_referral(text,text) from public;
grant execute on function public.visit_fundraiser_referral(text,text) to anon,authenticated;

-- Referral ownership and mission/campaign linkage are checked atomically.
create function public.create_referred_fundraiser(p_campaign uuid,p_actor uuid,p_kind text,p_slug text,p_title text,p_story text,p_goal numeric,p_ref_token text default null,p_source text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;v_mission uuid;v_ref uuid;
begin
 if not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;
 select mission_id into v_mission from public.fundraising_campaigns where id=p_campaign;
 if v_mission is null or not public.is_mission_participant(v_mission,p_actor) then raise exception 'Join the mission first'; end if;
 if p_ref_token is not null then
  select l.id into v_ref from public.fundraiser_referral_links l join public.fundraisers f on f.id=l.fundraiser_id where l.token=p_ref_token and f.campaign_id=p_campaign;
 end if;
 if v_ref is not null and coalesce(p_source,'direct') not in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy') then v_ref:=null; end if;
 insert into public.fundraisers(campaign_id,mission_id,actor_id,kind,slug,title,story,goal_amount,referred_by_link_id,referred_by_source)
 values(p_campaign,v_mission,p_actor,p_kind,p_slug,p_title,p_story,p_goal,v_ref,case when v_ref is null then null else coalesce(p_source,'direct') end) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_referred_fundraiser(uuid,uuid,text,text,text,text,numeric,text,text) from public;
grant execute on function public.create_referred_fundraiser(uuid,uuid,text,text,text,text,numeric,text,text) to authenticated;
revoke insert on public.fundraisers from authenticated;

create function public.fundraiser_referral_report(p_fundraiser uuid)
returns table(source text,clicks bigint,donations_attributed bigint,amount_raised numeric,new_fundraisers bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_link uuid;
begin
 if not exists(select 1 from public.fundraisers f join public.fundraising_campaigns c on c.id=f.campaign_id where f.id=p_fundraiser and (public.can_act_as(f.actor_id) or public.can_act_as(c.actor_id))) then
  raise exception 'Not permitted';
 end if;
 select id into v_link from public.fundraiser_referral_links where fundraiser_id=p_fundraiser;
 return query
 with sources(source) as (values ('direct'),('whatsapp'),('facebook'),('instagram'),('linkedin'),('x'),('tiktok'),('telegram'),('email'),('qr'),('copy'))
 select s.source,coalesce(k.clicks,0),
  (select count(*) from public.fundraiser_donations d where d.referral_link_id=v_link and d.referral_source=s.source),
  (select coalesce(sum(d.amount),0) from public.fundraiser_donations d where d.referral_link_id=v_link and d.referral_source=s.source),
  (select count(*) from public.fundraisers f where f.referred_by_link_id=v_link and f.referred_by_source=s.source)
 from sources s left join public.referral_source_counts k on k.referral_link_id=v_link and k.source=s.source;
end $$;
revoke all on function public.fundraiser_referral_report(uuid) from public;
grant execute on function public.fundraiser_referral_report(uuid) to authenticated;

alter table public.fundraiser_referral_links enable row level security;
alter table public.referral_source_counts enable row level security;
create policy "Public fundraiser referral links" on public.fundraiser_referral_links for select to anon,authenticated using(true);
create policy "Public campaign pages" on public.fundraising_campaigns for select to anon using(true);
create policy "Public fundraiser pages" on public.fundraisers for select to anon using(true);
create policy "Public fundraiser updates" on public.fundraiser_updates for select to anon using(true);
create policy "Public fundraiser comments" on public.fundraiser_comments for select to anon using(true);
grant execute on function public.fundraising_totals(uuid) to anon;
