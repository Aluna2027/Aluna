alter table public.missions
 add column if not exists removed_at timestamptz null;

alter table public.fundraising_campaigns
 add column if not exists removed_at timestamptz null,
 add column if not exists archived_at timestamptz null;

create index if not exists missions_removed_at_idx
 on public.missions(removed_at);

create index if not exists fundraising_campaigns_removed_archived_idx
 on public.fundraising_campaigns(removed_at,archived_at);

create or replace function public.remove_mission(p_mission uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
 v_actor uuid;
begin
 select m.created_by_actor_id into v_actor
 from public.missions m
 where m.id=p_mission and m.removed_at is null;

 if v_actor is null or not public.can_act_as(v_actor) then
  raise exception 'Not permitted';
 end if;

 if exists(select 1 from public.proofs p where p.mission_id=p_mission)
    or exists(
      select 1
      from public.fundraising_campaigns c
      where c.mission_id=p_mission
        and c.removed_at is null
        and (
          exists(select 1 from public.donation_checkouts d where d.campaign_id=c.id)
          or exists(select 1 from public.fundraiser_donations d where d.campaign_id=c.id)
        )
    )
 then
  raise exception 'Mission has protected impact or financial activity';
 end if;

 update public.missions
 set removed_at=now(),updated_at=now()
 where id=p_mission and removed_at is null;

 update public.fundraising_campaigns
 set removed_at=now(),updated_at=now()
 where mission_id=p_mission and removed_at is null;

 update public.campaign_referral_links
 set is_active=false,updated_at=now()
 where campaign_id in (
   select id from public.fundraising_campaigns where mission_id=p_mission
 ) and is_active=true;

 return 'removed';
end
$$;

revoke all on function public.remove_mission(uuid) from public,anon;
grant execute on function public.remove_mission(uuid) to authenticated;

create or replace function public.remove_or_archive_campaign(p_campaign uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
 v_actor uuid;
 v_has_financial boolean;
begin
 select c.actor_id into v_actor
 from public.fundraising_campaigns c
 where c.id=p_campaign and c.removed_at is null;

 if v_actor is null or not public.can_act_as(v_actor) then
  raise exception 'Not permitted';
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
end
$$;

revoke all on function public.remove_or_archive_campaign(uuid) from public,anon;
grant execute on function public.remove_or_archive_campaign(uuid) to authenticated;

create or replace function public.visit_campaign_referral(p_token text,p_source text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_link uuid;v_campaign uuid;
begin
 if p_source not in ('direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy') then return null; end if;
 select l.id,l.campaign_id into v_link,v_campaign
 from public.campaign_referral_links l
 join public.fundraising_campaigns c on c.id=l.campaign_id
 where l.token=p_token
   and l.is_active=true
   and c.removed_at is null
   and c.archived_at is null;
 if v_link is null then return null; end if;
 insert into public.campaign_referral_source_counts(referral_link_id,source,clicks)
 values(v_link,p_source,1)
 on conflict(referral_link_id,source) do update
 set clicks=public.campaign_referral_source_counts.clicks+1,updated_at=now();
 return v_campaign;
end
$$;

revoke all on function public.visit_campaign_referral(text,text) from public;
grant execute on function public.visit_campaign_referral(text,text) to anon,authenticated;
