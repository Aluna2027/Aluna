-- Integration test for the referral deduplication RPCs.
-- Run only on an isolated, migrated database with at least one active campaign
-- and fundraiser referral link. The transaction is rolled back at the end.
\set ON_ERROR_STOP on
begin;
-- Minimal synthetic fixture for both referral types. Triggers create the
-- profile actor and fundraiser referral link; the whole fixture rolls back.
insert into auth.users (
 instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values ('00000000-0000-0000-0000-000000000000',
 '77777777-7777-4777-8777-777777777777','authenticated','authenticated',
 'referral-test@pr33.invalid','',now(),now(),now());
insert into public.places(id,name,country_code,source_key)
values('88888888-8888-4888-8888-888888888888','PR33 Referral Test City','NL','pr33-referral-test');
insert into public.missions(id,city_id,created_by_actor_id,title,overview,location_text,goal)
select '99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',a.id,
 'PR33 Referral Test Mission','Synthetic mission for referral tests','Test City','Validate referral replay protection'
from public.actors a where a.profile_id='77777777-7777-4777-8777-777777777777';
insert into public.fundraising_campaigns(id,mission_id,actor_id,title,story,goal_amount,currency_code)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','99999999-9999-4999-8999-999999999999',a.id,
 'PR33 Referral Test Campaign','Synthetic campaign for referral security tests',100,'EUR'
from public.actors a where a.profile_id='77777777-7777-4777-8777-777777777777';
insert into public.campaign_referral_links(campaign_id,created_by_actor_id,label,source_type)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',a.id,'PR33 Security Test','other'
from public.actors a where a.profile_id='77777777-7777-4777-8777-777777777777';
insert into public.fundraisers(campaign_id,mission_id,actor_id,kind,slug,title,story,goal_amount)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','99999999-9999-4999-8999-999999999999',a.id,
 'personal','pr33-referral-test','PR33 Referral Test Fundraiser','Synthetic fundraiser for referral security tests',50
from public.actors a where a.profile_id='77777777-7777-4777-8777-777777777777';

set local role service_role;
do $referral_click_dedup$
declare
 v_token text; v_hash text := repeat('a',64); v_campaign uuid;
 v_before bigint; v_after bigint; v_first uuid; v_replay uuid; v_second uuid;
 v_fundraiser_token text; v_slug text; v_fundraiser_link uuid; v_fundraiser_before bigint; v_fundraiser_after bigint;
begin
 select l.token,l.campaign_id into v_token,v_campaign
 from public.campaign_referral_links l
 join public.fundraising_campaigns c on c.id=l.campaign_id
 where l.campaign_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and l.is_active and c.removed_at is null and c.archived_at is null
 limit 1;
 if v_token is null then raise exception 'Test fixture needs an active campaign referral link'; end if;
 select coalesce(clicks,0) into v_before from public.campaign_referral_source_counts
 where referral_link_id=(select id from public.campaign_referral_links where token=v_token) and source='direct';
 v_before:=coalesce(v_before,0);
 v_first:=public.visit_campaign_referral(v_token,'direct',v_hash);
 v_replay:=public.visit_campaign_referral(v_token,'direct',v_hash);
 if v_first is distinct from v_campaign or v_replay is distinct from v_campaign then
  raise exception 'Campaign referral redirect target was not preserved';
 end if;
 select coalesce(clicks,0) into v_after from public.campaign_referral_source_counts
 where referral_link_id=(select id from public.campaign_referral_links where token=v_token) and source='direct';
 if coalesce(v_after,0)<>v_before+1 then raise exception 'Campaign replay incremented more than once'; end if;
 if public.visit_campaign_referral('invalid-token','direct',v_hash) is not null then raise exception 'Invalid campaign token was accepted'; end if;
 if public.visit_campaign_referral(v_token,'not-a-source',repeat('b',64)) is not null then raise exception 'Invalid campaign source was accepted'; end if;
 v_second:=public.visit_campaign_referral(v_token,'direct',repeat('b',64));
 if v_second is distinct from v_campaign then raise exception 'Distinct visitor was not counted/redirected'; end if;

 select l.token,f.slug,l.id into v_fundraiser_token,v_slug,v_fundraiser_link
 from public.fundraiser_referral_links l join public.fundraisers f on f.id=l.fundraiser_id
 where f.slug='pr33-referral-test';
 if v_fundraiser_token is null then raise exception 'Test fixture needs a fundraiser referral link'; end if;
 select coalesce(clicks,0) into v_fundraiser_before from public.referral_source_counts
 where referral_link_id=v_fundraiser_link and source='direct';
 if public.visit_fundraiser_referral(v_fundraiser_token,'direct',v_hash) is distinct from v_slug
    or public.visit_fundraiser_referral(v_fundraiser_token,'direct',v_hash) is distinct from v_slug then
  raise exception 'Fundraiser referral replay did not preserve its redirect target';
 end if;
 select coalesce(clicks,0) into v_fundraiser_after from public.referral_source_counts
 where referral_link_id=v_fundraiser_link and source='direct';
 if coalesce(v_fundraiser_after,0)<>coalesce(v_fundraiser_before,0)+1 then raise exception 'Fundraiser replay incremented more than once'; end if;
 if public.visit_fundraiser_referral('invalid-token','direct',v_hash) is not null then raise exception 'Invalid fundraiser token was accepted'; end if;
 if public.visit_fundraiser_referral(v_fundraiser_token,'invalid-source',repeat('c',64)) is not null then raise exception 'Invalid fundraiser source was accepted'; end if;

 -- The unique primary key and INSERT .. ON CONFLICT are the atomic arbitration
 -- point for parallel duplicate requests. Confirm the exact key, not only an
 -- index name, so concurrent calls cannot both win.
 if not exists(
   select 1 from pg_constraint c
   where c.conrelid='public.referral_click_dedup'::regclass and c.contype='p'
     and (select array_agg(a.attname order by k.ord)
          from unnest(c.conkey) with ordinality k(attnum,ord)
          join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)
         = array['link_kind','referral_link_id','source','visitor_hash','visit_date']::name[]
 ) then raise exception 'Referral deduplication unique index is missing'; end if;
end $referral_click_dedup$;
rollback;
\echo 'PASS: referral source validation, redirect, replay deduplication, and concurrency key'
