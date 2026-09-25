-- Keep the private donation ledger inaccessible while exposing only an aggregated EUR total.
create function public.impact_money_raised(p_actor uuid default null,p_mission uuid default null,p_community uuid default null,p_city uuid default null)
returns numeric language sql stable security definer set search_path = '' as $$
 select coalesce(sum(d.amount-d.refunded_amount),0)
 from public.fundraiser_donations d
 join public.fundraising_campaigns c on c.id=d.campaign_id
 join public.missions m on m.id=c.mission_id
 where auth.uid() is not null and d.currency_code='EUR'
   and (p_actor is null or c.actor_id=p_actor or exists(
     select 1 from public.fundraisers f where f.id=d.fundraiser_id and f.actor_id=p_actor))
   and (p_mission is null or m.id=p_mission)
   and (p_community is null or m.community_id=p_community)
   and (p_city is null or m.city_id=p_city)
$$;
revoke all on function public.impact_money_raised(uuid,uuid,uuid,uuid) from public;
grant execute on function public.impact_money_raised(uuid,uuid,uuid,uuid) to authenticated;

-- Submission rules must also apply to direct RPC calls, not just the form.
create or replace function public.submit_first340_application(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_application public.first340_applications%rowtype;
begin
 select * into v_application from public.first340_applications
 where id=p_id and profile_id=auth.uid() for update;
 if not found or v_application.status<>'draft' then raise exception 'Application unavailable'; end if;
 if char_length(trim(v_application.motivation))<10 or char_length(trim(v_application.country))<1 then
  raise exception 'Complete the required application fields';
 end if;
 update public.first340_applications set status='submitted',submitted_at=now(),updated_at=now() where id=p_id;
 insert into public.first340_audit(application_id,actor_profile_id,previous_status,new_status,note)
 values(p_id,auth.uid(),'draft','submitted','Applicant submitted their application');
end $$;

-- Team capacity and audit state are managed by trusted database functions only.
revoke insert,update,delete on public.first340_teams from anon,authenticated;
