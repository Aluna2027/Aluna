-- Phase 9: private checkout state, verified payment ledger and refund reconciliation.
create table public.donation_checkouts (
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null unique,
 campaign_id uuid not null references public.fundraising_campaigns(id) on delete restrict,
 fundraiser_id uuid references public.fundraisers(id) on delete restrict,
 donor_user_id uuid references public.profiles(id) on delete set null,
 amount_minor bigint not null check(amount_minor between 100 and 10000000),
 currency_code char(3) not null check(currency_code in ('EUR','USD','GBP')),
 frequency text not null check(frequency in ('once','monthly')),
 donation_kind text not null check(donation_kind in ('standard','sponsorship')),
 donor_kind text not null check(donor_kind in ('individual','company')),
 company_name text check(company_name is null or char_length(company_name) between 2 and 180),
 anonymous boolean not null default false,
 referral_link_id uuid references public.fundraiser_referral_links(id) on delete restrict,
 referral_source text check(referral_source is null or referral_source in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy')),
 status text not null default 'pending' check(status in ('pending','checkout','paid','failed','expired','partially_refunded','refunded')),
 stripe_session_id text unique,
 stripe_session_url text,
 stripe_subscription_id text unique,
 subscription_status text check(subscription_status is null or subscription_status in ('active','past_due','canceled')),
 stripe_customer_id text,
 donor_email text,
 donor_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint checkout_referral_pair check((referral_link_id is null)=(referral_source is null)),
 constraint company_name_required check(donor_kind<>'company' or company_name is not null)
);
create index donation_checkouts_user_idx on public.donation_checkouts(donor_user_id,created_at desc) where donor_user_id is not null;
create index donation_checkouts_campaign_idx on public.donation_checkouts(campaign_id,created_at desc);
create function public.check_donation_checkout() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.fundraising_campaigns c where c.id=new.campaign_id and c.currency_code=new.currency_code) then raise exception 'Checkout campaign or currency mismatch'; end if;
 if new.fundraiser_id is not null and not exists(select 1 from public.fundraisers f where f.id=new.fundraiser_id and f.campaign_id=new.campaign_id) then raise exception 'Checkout fundraiser mismatch'; end if;
 if new.referral_link_id is not null and not exists(select 1 from public.fundraiser_referral_links l join public.fundraisers f on f.id=l.fundraiser_id where l.id=new.referral_link_id and f.campaign_id=new.campaign_id) then raise exception 'Checkout referral mismatch'; end if;
 return new;
end $$;
create trigger donation_checkout_guard before insert on public.donation_checkouts for each row execute function public.check_donation_checkout();

alter table public.fundraiser_donations add column checkout_id uuid references public.donation_checkouts(id) on delete restrict;
alter table public.fundraiser_donations add column stripe_payment_intent_id text unique;
alter table public.fundraiser_donations add column stripe_invoice_id text unique;
alter table public.fundraiser_donations add column stripe_charge_id text;
alter table public.fundraiser_donations add column receipt_url text;
alter table public.fundraiser_donations add column refunded_amount numeric(14,2) not null default 0 check(refunded_amount>=0 and refunded_amount<=amount);
create index fundraiser_donations_checkout_idx on public.fundraiser_donations(checkout_id) where checkout_id is not null;
create unique index fundraiser_donations_single_payment_idx on public.fundraiser_donations(checkout_id) where checkout_id is not null and stripe_invoice_id is null;
create index fundraiser_donations_charge_idx on public.fundraiser_donations(stripe_charge_id) where stripe_charge_id is not null;
create table public.donation_refunds (
 provider_refund_id text primary key,
 donation_id uuid not null references public.fundraiser_donations(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0),
 status text not null check(status in ('pending','succeeded','failed','canceled')),
 updated_at timestamptz not null default now()
);
create index donation_refunds_donation_idx on public.donation_refunds(donation_id);
create table public.donation_webhook_events (
 event_id text primary key,
 event_type text not null,
 processed_at timestamptz not null default now()
);

create function public.record_checkout_payment_event(p_event text,p_type text,p_checkout uuid,p_session text,p_subscription text,p_customer text,p_email text,p_name text,p_state text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.donation_checkouts%rowtype;
begin
 if p_state not in ('checkout','failed','expired') then raise exception 'Invalid checkout state'; end if;
 select * into v_row from public.donation_checkouts where id=p_checkout for update;
 if not found or (v_row.stripe_session_id is not null and v_row.stripe_session_id<>p_session)
  or (v_row.stripe_subscription_id is not null and p_subscription is not null and v_row.stripe_subscription_id<>p_subscription) then raise exception 'Checkout mismatch'; end if;
 insert into public.donation_webhook_events(event_id,event_type) values(p_event,p_type) on conflict do nothing;
 if not found then return false; end if;
 update public.donation_checkouts set stripe_session_id=coalesce(stripe_session_id,p_session),stripe_subscription_id=coalesce(stripe_subscription_id,p_subscription),stripe_customer_id=coalesce(stripe_customer_id,p_customer),donor_email=coalesce(p_email,donor_email),donor_name=coalesce(p_name,donor_name),
  status=case when status in ('paid','partially_refunded','refunded') then status else p_state end,updated_at=now()
 where id=p_checkout;
 return true;
end $$;

create function public.record_confirmed_donation(p_event text,p_type text,p_checkout uuid,p_session text,p_payment text,p_invoice text,p_charge text,p_amount bigint,p_currency text,p_customer text,p_email text,p_name text,p_receipt text,p_confirmed timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
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
 insert into public.fundraiser_donations(campaign_id,fundraiser_id,checkout_id,donor_reference,amount,currency_code,provider_reference,confirmed_at,referral_link_id,referral_source,stripe_payment_intent_id,stripe_invoice_id,stripe_charge_id,receipt_url)
 values(v_row.campaign_id,v_row.fundraiser_id,v_row.id,coalesce(p_customer,v_ref),p_amount::numeric/100,v_row.currency_code,v_ref,p_confirmed,v_row.referral_link_id,v_row.referral_source,p_payment,p_invoice,p_charge,p_receipt)
 on conflict(provider_reference) do nothing;
 select * into v_existing from public.fundraiser_donations where provider_reference=v_ref;
 if v_existing.checkout_id is distinct from p_checkout or v_existing.amount<>p_amount::numeric/100 or v_existing.currency_code<>v_row.currency_code then raise exception 'Payment reference conflict'; end if;
 update public.donation_checkouts set stripe_session_id=coalesce(stripe_session_id,p_session),stripe_customer_id=coalesce(stripe_customer_id,p_customer),donor_email=coalesce(p_email,donor_email),donor_name=coalesce(p_name,donor_name),
  status=case when frequency='monthly' then 'paid' when status in ('partially_refunded','refunded') then status else 'paid' end,updated_at=now()
 where id=p_checkout;
 return true;
end $$;

create function public.record_donation_refund(p_event text,p_type text,p_payment text,p_charge text,p_refund text,p_amount bigint,p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_donation public.fundraiser_donations%rowtype;v_refunded numeric;v_affected integer;
begin
 if p_status not in ('pending','succeeded','failed','canceled') or p_amount<=0 then raise exception 'Invalid refund'; end if;
 select * into v_donation from public.fundraiser_donations where (p_payment is not null and stripe_payment_intent_id=p_payment) or (p_charge is not null and stripe_charge_id=p_charge) for update;
 if not found then raise exception 'Donation for refund not found'; end if;
 insert into public.donation_webhook_events(event_id,event_type) values(p_event,p_type) on conflict do nothing;
 if not found then return false; end if;
 insert into public.donation_refunds(provider_refund_id,donation_id,amount,status) values(p_refund,v_donation.id,p_amount::numeric/100,p_status)
 on conflict(provider_refund_id) do update set status=excluded.status,updated_at=now() where public.donation_refunds.donation_id=excluded.donation_id and public.donation_refunds.amount=excluded.amount;
 get diagnostics v_affected=row_count;
 if v_affected<>1 then raise exception 'Refund reference conflict'; end if;
 select coalesce(sum(amount),0) into v_refunded from public.donation_refunds where donation_id=v_donation.id and status='succeeded';
 if v_refunded>v_donation.amount then raise exception 'Refunds exceed donation'; end if;
 update public.fundraiser_donations set refunded_amount=v_refunded where id=v_donation.id;
 if v_donation.checkout_id is not null then
  update public.donation_checkouts set status=case when frequency='monthly' then
    case when (select coalesce(sum(amount-refunded_amount),0) from public.fundraiser_donations where checkout_id=v_donation.checkout_id)=0 then 'refunded' else 'paid' end
   when v_refunded=v_donation.amount then 'refunded' when v_refunded>0 then 'partially_refunded' else 'paid' end,updated_at=now() where id=v_donation.checkout_id;
 end if;
 return true;
end $$;

create function public.record_subscription_event(p_event text,p_type text,p_checkout uuid,p_subscription text,p_state text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.donation_checkouts%rowtype;
begin
 if p_state not in ('active','past_due','canceled') then raise exception 'Invalid subscription state'; end if;
 select * into v_row from public.donation_checkouts where id=p_checkout for update;
 if not found or v_row.frequency<>'monthly' or (v_row.stripe_subscription_id is not null and v_row.stripe_subscription_id<>p_subscription) then raise exception 'Subscription mismatch'; end if;
 insert into public.donation_webhook_events(event_id,event_type) values(p_event,p_type) on conflict do nothing;
 if not found then return false; end if;
 update public.donation_checkouts set stripe_subscription_id=coalesce(stripe_subscription_id,p_subscription),subscription_status=p_state,updated_at=now() where id=p_checkout;
 return true;
end $$;

-- Totals represent net confirmed funds. Fully refunded donations do not count as donors.
create or replace function public.fundraising_totals(p_campaign uuid) returns table(fundraiser_id uuid,amount_raised numeric,donor_count bigint)
language sql stable security definer set search_path = '' as $$
 select d.fundraiser_id,coalesce(sum(d.amount-d.refunded_amount),0),count(distinct d.donor_reference) filter(where d.amount>d.refunded_amount)
 from public.fundraiser_donations d where d.campaign_id=p_campaign group by grouping sets ((d.fundraiser_id),())
 having grouping(d.fundraiser_id)=1 or d.fundraiser_id is not null
$$;
create or replace function public.fundraiser_referral_report(p_fundraiser uuid)
returns table(source text,clicks bigint,donations_attributed bigint,amount_raised numeric,new_fundraisers bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_link uuid;
begin
 if not exists(select 1 from public.fundraisers f join public.fundraising_campaigns c on c.id=f.campaign_id where f.id=p_fundraiser and (public.can_act_as(f.actor_id) or public.can_act_as(c.actor_id))) then raise exception 'Not permitted'; end if;
 select id into v_link from public.fundraiser_referral_links where fundraiser_id=p_fundraiser;
 return query
 with sources(source) as (values ('direct'),('whatsapp'),('facebook'),('instagram'),('linkedin'),('x'),('tiktok'),('telegram'),('email'),('qr'),('copy'))
 select s.source,coalesce(k.clicks,0),
  (select count(*) from public.fundraiser_donations d where d.referral_link_id=v_link and d.referral_source=s.source and d.amount>d.refunded_amount),
  (select coalesce(sum(d.amount-d.refunded_amount),0) from public.fundraiser_donations d where d.referral_link_id=v_link and d.referral_source=s.source),
  (select count(*) from public.fundraisers f where f.referred_by_link_id=v_link and f.referred_by_source=s.source)
 from sources s left join public.referral_source_counts k on k.referral_link_id=v_link and k.source=s.source;
end $$;

alter table public.donation_checkouts enable row level security;
alter table public.donation_refunds enable row level security;
alter table public.donation_webhook_events enable row level security;
revoke all on public.donation_checkouts,public.donation_refunds,public.donation_webhook_events from anon,authenticated;
revoke all on function public.record_checkout_payment_event(text,text,uuid,text,text,text,text,text,text) from public;
revoke all on function public.record_confirmed_donation(text,text,uuid,text,text,text,text,bigint,text,text,text,text,text,timestamptz) from public;
revoke all on function public.record_donation_refund(text,text,text,text,text,bigint,text) from public;
revoke all on function public.record_subscription_event(text,text,uuid,text,text) from public;
grant execute on function public.record_checkout_payment_event(text,text,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.record_confirmed_donation(text,text,uuid,text,text,text,text,bigint,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.record_donation_refund(text,text,text,text,text,bigint,text) to service_role;
grant execute on function public.record_subscription_event(text,text,uuid,text,text) to service_role;
