-- Include referral creation timestamp in campaign referral analytics.

drop function if exists public.campaign_referral_report(uuid);

create function public.campaign_referral_report(p_campaign uuid)
returns table(
 link_id uuid,
 token text,
 label text,
 source_type text,
 assigned_actor_id uuid,
 assigned_name text,
 is_active boolean,
 created_at timestamptz,
 clicks bigint,
 checkouts bigint,
 donor_count bigint,
 donations_attributed bigint,
 amount_raised numeric,
 average_donation numeric
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
 if not exists(
  select 1
  from public.fundraising_campaigns c
  where c.id=p_campaign
    and public.can_act_as(c.actor_id)
 ) then
  raise exception 'Not permitted';
 end if;

 return query
 select
  l.id,
  l.token,
  l.label,
  l.source_type,
  l.assigned_actor_id,
  l.assigned_name,
  l.is_active,
  l.created_at,
  coalesce((select sum(k.clicks) from public.campaign_referral_source_counts k where k.referral_link_id=l.id),0)::bigint,
  coalesce((select count(*) from public.donation_checkouts dc where dc.campaign_referral_link_id=l.id),0)::bigint,
  coalesce((select count(distinct d.donor_reference) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount),0)::bigint,
  coalesce((select count(*) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount),0)::bigint,
  coalesce((select sum(d.amount-d.refunded_amount) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id),0)::numeric,
  coalesce((select avg(d.amount-d.refunded_amount) from public.fundraiser_donations d where d.campaign_referral_link_id=l.id and d.amount>d.refunded_amount),0)::numeric
 from public.campaign_referral_links l
 where l.campaign_id=p_campaign
 order by l.created_at desc;
end
$$;

revoke all on function public.campaign_referral_report(uuid) from public,anon;
grant execute on function public.campaign_referral_report(uuid) to authenticated;
