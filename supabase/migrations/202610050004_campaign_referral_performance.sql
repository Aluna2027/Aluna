-- Campaign-level referral attribution, performance analytics, and fundraising leaderboards.

create table if not exists public.campaign_referral_links (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.fundraising_campaigns(id) on delete cascade,
 created_by_actor_id uuid not null references public.actors(id) on delete restrict,
 token text not null unique default md5(gen_random_uuid()::text || gen_random_uuid()::text) check(token ~ '^[a-f0-9]{32}$'),
 label text not null check(char_length(label) between 2 and 180),
 source_type text not null check(source_type in ('influencer','partner','team_member','university','ngo','company','social','qr','newsletter','event','other')),
 assigned_actor_id uuid references public.actors(id) on delete set null,
 assigned_name text check(assigned_name is null or char_length(assigned_name) between 2 and 180),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists campaign_referral_links_campaign_idx on public.campaign_referral_links(campaign_id,created_at desc);
create index if not exists campaign_referral_links_assigned_actor_idx on public.campaign_referral_links(assigned_actor_id) where assigned_actor_id is not null;
create index if not exists campaign_referral_links_token_idx on public.campaign_referral_links(token);

create table if not exists public.campaign_referral_source_counts (
 referral_link_id uuid not null references public.campaign_referral_links(id) on delete cascade,
 source text not null check(source in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy')),
 clicks bigint not null default 0 check(clicks>=0),
 updated_at timestamptz not null default now(),
 primary key(referral_link_id,source)
);

alter table public.campaign_referral_links enable row level security;
alter table public.campaign_referral_source_counts enable row level security;

revoke all on public.campaign_referral_links from anon,authenticated;
revoke all on public.campaign_referral_source_counts from anon,authenticated;
grant select,insert on public.campaign_referral_links to authenticated;
grant update(label,source_type,assigned_actor_id,assigned_name,is_active,updated_at) on public.campaign_referral_links to authenticated;

drop policy if exists "View managed campaign referral links" on public.campaign_referral_links;
create policy "View managed campaign referral links" on public.campaign_referral_links
 for select to authenticated
 using (public.can_act_as(created_by_actor_id) or (assigned_actor_id is not null and public.can_act_as(assigned_actor_id)));

drop policy if exists "Create managed campaign referral links" on public.campaign_referral_links;
create policy "Create managed campaign referral links" on public.campaign_referral_links
 for insert to authenticated
 with check (
  public.can_act_as(created_by_actor_id)
  and exists(select 1 from public.fundraising_campaigns c where c.id=campaign_id and c.actor_id=created_by_actor_id)
 );

drop policy if exists "Update managed campaign referral links" on public.campaign_referral_links;
create policy "Update managed campaign referral links" on public.campaign_referral_links
 for update to authenticated
 using (
  public.can_act_as(created_by_actor_id)
  and exists(select 1 from public.fundraising_campaigns c where c.id=campaign_id and c.actor_id=created_by_actor_id)
 )
 with check (
  public.can_act_as(created_by_actor_id)
  and exists(select 1 from public.fundraising_campaigns c where c.id=campaign_id and c.actor_id=created_by_actor_id)
 );

alter table public.donation_checkouts add column if not exists campaign_referral_link_id uuid references public.campaign_referral_links(id) on delete restrict;
alter table public.fundraiser_donations add column if not exists campaign_referral_link_id uuid references public.campaign_referral_links(id) on delete restrict;

create index if not exists donation_checkouts_campaign_referral_idx on public.donation_checkouts(campaign_referral_link_id) where campaign_referral_link_id is not null;
create index if not exists fundraiser_donations_campaign_referral_idx on public.fundraiser_donations(campaign_referral_link_id) where campaign_referral_link_id is not null;

alter table public.donation_checkouts drop constraint if exists checkout_referral_pair;
alter table public.donation_checkouts add constraint checkout_referral_pair check(
 (referral_source is null and referral_link_id is null and campaign_referral_link_id is null)
 or
 (referral_source is not null and num_nonnulls(referral_link_id,campaign_referral_link_id)=1)
);

alter table public.fundraiser_donations drop constraint if exists donation_referral_pair;
alter table public.fundraiser_donations add constraint donation_referral_pair check(
 (referral_source is null and referral_link_id is null and campaign_referral_link_id is null)
 or
 (referral_source is not null and num_nonnulls(referral_link_id,campaign_referral_link_id)=1)
);

create or replace function public.check_campaign_referral_attribution()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
 if new.campaign_referral_link_id is not null and not exists(
  select 1 from public.campaign_referral_links l
  where l.id=new.campaign_referral_link_id and l.campaign_id=new.campaign_id
 ) then raise exception 'Campaign referral does not belong to this campaign'; end if;
 return new;
end
$$;

drop trigger if exists checkout_campaign_referral_guard on public.donation_checkouts;
create trigger checkout_campaign_referral_guard before insert or update of campaign_referral_link_id,campaign_id
on public.donation_checkouts for each row execute function public.check_campaign_referral_attribution();

drop trigger if exists donation_campaign_referral_guard on public.fundraiser_donations;
create trigger donation_campaign_referral_guard before insert or update of campaign_referral_link_id,campaign_id
on public.fundraiser_donations for each row execute function public.check_campaign_referral_attribution();

revoke all on function public.check_campaign_referral_attribution() from public,anon,authenticated;

create or replace function public.visit_campaign_referral(p_token text,p_source text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_link uuid;v_campaign uuid;
begin
 if p_source not in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy') then return null; end if;
 select l.id,l.campaign_id into v_link,v_campaign from public.campaign_referral_links l where l.token=p_token and l.is_active=true;
 if v_link is null then return null; end if;
 insert into public.campaign_referral_source_counts(referral_link_id,source,clicks) values(v_link,p_source,1)
 on conflict(referral_link_id,source) do update set clicks=public.campaign_referral_source_counts.clicks+1,updated_at=now();
 return v_campaign;
end
$$;
revoke all on function public.visit_campaign_referral(text,text) from public;
grant execute on function public.visit_campaign_referral(text,text) to anon,authenticated;

create or replace function public.record_confirmed_donation(p_event text, p_type text, p_checkout uuid, p_session text, p_payment text, p_invoice text, p_charge text, p_amount bigint, p_currency text, p_customer text, p_email text, p_name text, p_receipt text, p_confirmed timestamptz)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.donation_checkouts%rowtype;v_ref text;v_existing public.fundraiser_donations%rowtype;
begin
 select * into v_row from public.donation_checkouts where id=p_checkout for update;
 if not found or (v_row.stripe_session_id is not null and p_session is not null and v_row.stripe_session_id<>p_session)
  or upper(p_currency)<>v_row.currency_code or p_amount<=0 or
  (v_row.frequency='once' and (p_invoice is not null or p_session is null or p_payment is null or p_amount<>v_row.amount_minor)) or
  (v_row.frequency='monthly' and (p_invoice is null or p_amount>v_row.amount_minor)) then raise exception 'Payment does not match checkout'; end if;
 v_ref:=coalesce(p_invoice,p_payment);
 if v_ref is null then raise exception 'Missing payment reference'; end if;
 insert into public.donation_webhook_events(event_id,event_type) values(p_event,p_type) on conflict do nothing;
 if not found then return false; end if;
 insert into public.fundraiser_donations(campaign_id,fundraiser_id,checkout_id,donor_reference,amount,currency_code,provider_reference,confirmed_at,referral_link_id,campaign_referral_link_id,referral_source,stripe_payment_intent_id,stripe_invoice_id,stripe_charge_id,receipt_url)
 values(v_row.campaign_id,v_row.fundraiser_id,v_row.id,coalesce(p_customer,v_ref),p_amount::numeric/100,v_row.currency_code,v_ref,p_confirmed,v_row.referral_link_id,v_row.campaign_referral_link_id,v_row.referral_source,p_payment,p_invoice,p_charge,p_receipt)
 on conflict(provider_reference) do nothing;
 select * into v_existing from public.fundraiser_donations where provider_reference=v_ref;
 if v_existing.checkout_id is distinct from p_checkout or v_existing.amount<>p_amount::numeric/100 or v_existing.currency_code<>v_row.currency_code then raise exception 'Payment reference conflict'; end if;
 update public.donation_checkouts set stripe_session_id=coalesce(stripe_session_id,p_session),stripe_customer_id=coalesce(stripe_customer_id,p_customer),donor_email=coalesce(p_email,donor_email),donor_name=coalesce(p_name,donor_name),
  status=case when frequency='monthly' then 'paid' when status in ('partially_refunded','refunded') then status else 'paid' end,updated_at=now()
 where id=p_checkout;
 return true;
end
$$;

drop function if exists public.campaign_referral_report(uuid);
create function public.campaign_referral_report(p_campaign uuid)
returns table(
 link_id uuid,token text,label text,source_type text,assigned_actor_id uuid,assigned_name text,is_active boolean,
 clicks bigint,checkouts bigint,donor_count bigint,donations_attributed bigint,amount_raised numeric,average_donation numeric
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
 if not exists(select 1 from public.fundraising_campaigns c where c.id=p_campaign and public.can_act_as(c.actor_id)) then raise exception 'Not permitted'; end if;
 return query
 select l.id,l.token,l.label,l.source_type,l.assigned_actor_id,l.assigned_name,l.is_active,
  coalesce((select sum(k.clicks) from public.campaign_referral_source_counts k where k.referral_link_id=l.id),0)::bigint,
  coalesce((select count(*) from public.donation_checkouts dc where dc.campaign_referral_link_id=l.id),0)::bigint,
  coalesce((select count(distinct d.donor_reference) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount),0)::bigint,
  coalesce((select count(*) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount),0)::bigint,
  coalesce((select sum(d.amount-d.refunded_amount) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id),0)::numeric,
  coalesce((select avg(d.amount-d.refunded_amount) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount),0)::numeric
 from public.campaign_referral_links l where l.campaign_id=p_campaign order by l.created_at desc;
end
$$;
revoke all on function public.campaign_referral_report(uuid) from public,anon;
grant execute on function public.campaign_referral_report(uuid) to authenticated;

drop function if exists public.fundraising_actor_leaderboard(text,text,integer);
create function public.fundraising_actor_leaderboard(p_scope text default 'all', p_org_type text default null, p_limit integer default 50)
returns table(
 actor_id uuid,actor_name text,actor_kind text,currency_code char(3),amount_raised numeric,
 donor_count bigint,donations_attributed bigint,clicks bigint,campaigns bigint
)
language sql
stable
security definer
set search_path=''
as $$
 with donation_metrics as (
  select l.assigned_actor_id actor_id,c.currency_code,
   coalesce(sum(d.amount-d.refunded_amount),0)::numeric amount_raised,
   count(distinct d.donor_reference)::bigint donor_count,
   count(d.id)::bigint donations_attributed,
   count(distinct l.campaign_id)::bigint campaigns
  from public.campaign_referral_links l
  join public.fundraising_campaigns c on c.id=l.campaign_id
  left join public.fundraiser_donations d on d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount
  where l.assigned_actor_id is not null group by l.assigned_actor_id,c.currency_code
 ),
 click_metrics as (
  select l.assigned_actor_id actor_id,c.currency_code,coalesce(sum(k.clicks),0)::bigint clicks
  from public.campaign_referral_links l
  join public.fundraising_campaigns c on c.id=l.campaign_id
  join public.campaign_referral_source_counts k on k.referral_link_id=l.id
  where l.assigned_actor_id is not null group by l.assigned_actor_id,c.currency_code
 )
 select a.id,coalesce(p.display_name,o.name,'Member')::text,
  case when a.profile_id is not null then 'user' else coalesce(o.organization_type::text,'organization') end,
  dm.currency_code,coalesce(dm.amount_raised,0),coalesce(dm.donor_count,0),coalesce(dm.donations_attributed,0),coalesce(cm.clicks,0),coalesce(dm.campaigns,0)
 from public.actors a
 left join public.profiles p on p.id=a.profile_id
 left join public.organizations o on o.id=a.organization_id
 join donation_metrics dm on dm.actor_id=a.id
 left join click_metrics cm on cm.actor_id=a.id and cm.currency_code=dm.currency_code
 where (p_scope='all' or (p_scope='user' and a.profile_id is not null) or (p_scope='organization' and a.organization_id is not null))
 and (p_org_type is null or (a.organization_id is not null and o.organization_type::text=p_org_type))
 order by dm.currency_code,coalesce(dm.amount_raised,0) desc,coalesce(dm.donor_count,0) desc,coalesce(cm.clicks,0) desc
 limit greatest(1,least(coalesce(p_limit,50),200));
$$;
revoke all on function public.fundraising_actor_leaderboard(text,text,integer) from public,anon;
grant execute on function public.fundraising_actor_leaderboard(text,text,integer) to authenticated;

drop function if exists public.fundraising_global_performance();
create function public.fundraising_global_performance()
returns table(
 currency_code char(3),amount_raised numeric,donor_count bigint,donations_attributed bigint,
 clicks bigint,campaigns bigint,users bigint,organizations bigint
)
language sql
stable
security definer
set search_path=''
as $$
 with currencies as (
  select distinct c.currency_code from public.campaign_referral_links l
  join public.fundraising_campaigns c on c.id=l.campaign_id where l.assigned_actor_id is not null
 ),
 metrics as (
  select c.currency_code,coalesce(sum(d.amount-d.refunded_amount),0)::numeric amount_raised,
   count(distinct d.donor_reference)::bigint donor_count,count(d.id)::bigint donations_attributed,
   count(distinct l.campaign_id)::bigint campaigns,
   count(distinct a.id) filter(where a.profile_id is not null)::bigint users,
   count(distinct a.id) filter(where a.organization_id is not null)::bigint organizations
  from public.campaign_referral_links l
  join public.fundraising_campaigns c on c.id=l.campaign_id
  join public.actors a on a.id=l.assigned_actor_id
  left join public.fundraiser_donations d on d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount
  where l.assigned_actor_id is not null group by c.currency_code
 ),
 clicks as (
  select c.currency_code,coalesce(sum(k.clicks),0)::bigint clicks
  from public.campaign_referral_links l
  join public.fundraising_campaigns c on c.id=l.campaign_id
  left join public.campaign_referral_source_counts k on k.referral_link_id=l.id
  where l.assigned_actor_id is not null group by c.currency_code
 )
 select x.currency_code,coalesce(m.amount_raised,0),coalesce(m.donor_count,0),coalesce(m.donations_attributed,0),coalesce(k.clicks,0),coalesce(m.campaigns,0),coalesce(m.users,0),coalesce(m.organizations,0)
 from currencies x left join metrics m on m.currency_code=x.currency_code left join clicks k on k.currency_code=x.currency_code
 order by x.currency_code;
$$;
revoke all on function public.fundraising_global_performance() from public,anon;
grant execute on function public.fundraising_global_performance() to authenticated;
