-- PREPARED ONLY: do not apply to a live Supabase project before review and tests.
-- A campaign row lock serializes checkout insertion and campaign archive/removal.
-- Pending checkouts (including those created before Stripe session creation) must settle
-- or be explicitly reconciled before archival. No financial history is deleted.
create or replace function public.guard_donation_checkout_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.fundraising_campaigns%rowtype;
begin
  select * into v_campaign
  from public.fundraising_campaigns
  where id = new.campaign_id
  for update;

  if not found or v_campaign.removed_at is not null or v_campaign.archived_at is not null then
    raise exception 'Campaign is not accepting donations';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_donation_checkout_campaign on public.donation_checkouts;
create trigger trg_guard_donation_checkout_campaign
before insert or update of campaign_id on public.donation_checkouts
for each row execute function public.guard_donation_checkout_campaign();

create or replace function public.remove_or_archive_campaign(p_campaign uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_has_financial boolean;
  v_unsettled boolean;
begin
  -- Must lock the same parent row as the donation checkout insert trigger.
  select c.actor_id into v_actor
  from public.fundraising_campaigns c
  where c.id = p_campaign and c.removed_at is null
  for update;

  if v_actor is null or not public.can_act_as(v_actor) then
    raise exception 'Not permitted';
  end if;

  select exists (
    select 1 from public.donation_checkouts d
    where d.campaign_id = p_campaign
      and (
        d.status in ('pending', 'checkout')
        or (
          d.frequency = 'monthly'
          and (
            d.subscription_status is null
            or d.subscription_status not in ('canceled', 'incomplete_expired')
          )
          and d.stripe_subscription_id is not null
        )
      )
  ) into v_unsettled;

  if v_unsettled then
    raise exception 'Campaign has unsettled checkouts or subscriptions';
  end if;

  select exists(select 1 from public.donation_checkouts d where d.campaign_id=p_campaign)
    or exists(select 1 from public.fundraiser_donations d where d.campaign_id=p_campaign)
  into v_has_financial;

  if v_has_financial then
    update public.fundraising_campaigns
    set archived_at=coalesce(archived_at,now()),updated_at=now()
    where id=p_campaign and removed_at is null;
    update public.campaign_referral_links
    set is_active=false,updated_at=now()
    where campaign_id=p_campaign and is_active=true;
    return 'archived';
  end if;

  update public.fundraising_campaigns
  set removed_at=now(),updated_at=now()
  where id=p_campaign and removed_at is null;
  update public.campaign_referral_links
  set is_active=false,updated_at=now()
  where campaign_id=p_campaign and is_active=true;
  return 'removed';
end;
$$;

revoke all on function public.guard_donation_checkout_campaign() from public, anon, authenticated;
