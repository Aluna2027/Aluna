-- Evidence and attestations are distinct from ordinary posts. No automated verification is asserted.
create table public.proof_verifier_grants (
 profile_id uuid primary key references public.profiles(id) on delete restrict,
 max_level smallint not null check (max_level in (3,4)),
 granted_at timestamptz not null default now(),
 rationale text not null check (char_length(rationale) between 10 and 1000)
);
alter table public.proof_verifier_grants enable row level security;
-- Provision and revoke grants through a trusted Supabase admin/service process only.
revoke all on public.proof_verifier_grants from anon, authenticated;

create table public.proofs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.actors(id) on delete restrict,
 mission_id uuid references public.missions(id) on delete restrict,
 city_id uuid references public.places(id) on delete restrict,
 contribution_id uuid references public.contributions(id) on delete restrict,
 post_id uuid references public.posts(id) on delete restrict,
 post_snapshot text,
 evidence_type text not null check (evidence_type in ('photo','video','geolocation','partner_confirmation','local_survey','sensor_data','mesh_telemetry')),
 evidence_url text check (evidence_url is null or (char_length(evidence_url)<=2000 and evidence_url ~ '^https://[^[:space:]]+$')),
 evidence_description text not null check (char_length(evidence_description) between 10 and 3000),
 latitude numeric(9,6), longitude numeric(9,6),
 result_text text not null check (char_length(result_text) between 10 and 3000),
 occurred_on date not null,
 verification_level smallint not null default 1 check (verification_level between 1 and 4),
 created_at timestamptz not null default now(),
 constraint proof_has_source check (contribution_id is not null or post_id is not null),
 constraint proof_coordinates check ((latitude is null) = (longitude is null) and (latitude is null or (latitude between -90 and 90 and longitude between -180 and 180))),
 constraint geolocation_has_coordinates check (evidence_type<>'geolocation' or latitude is not null)
);
create index proofs_actor_idx on public.proofs(actor_id,created_at desc);
create index proofs_mission_idx on public.proofs(mission_id,created_at desc) where mission_id is not null;
create index proofs_contribution_idx on public.proofs(contribution_id);
create index proofs_post_idx on public.proofs(post_id);
create table public.proof_verification_events (
 id uuid primary key default gen_random_uuid(),
 proof_id uuid not null references public.proofs(id) on delete restrict,
 previous_level smallint,
 new_level smallint not null check(new_level between 1 and 4),
 verifier_actor_id uuid not null references public.actors(id) on delete restrict,
 verifier_profile_id uuid not null references public.profiles(id) on delete restrict,
 method text not null check(method in ('self_report','peer_attestation','partner_review','ground_visit')),
 -- Reserved for a later trusted ingestion workflow. Current RPCs only write manual reviews.
 evidence_origin text not null default 'manual' check(evidence_origin in ('manual','trusted_mesh','trusted_sensor')),
 source_reference text,
 source_sha256 text check(source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
 constraint trusted_source_trace check(evidence_origin='manual' or (source_reference is not null and char_length(source_reference) between 1 and 500 and source_sha256 is not null)),
 reason text not null check(char_length(reason) between 10 and 2000),
 recorded_at timestamptz not null default now(),
 constraint distinct_transition check (previous_level is null or previous_level<>new_level)
);
create index proof_events_idx on public.proof_verification_events(proof_id,recorded_at,id);
alter table public.proofs enable row level security;
alter table public.proof_verification_events enable row level security;
create policy "Read proofs" on public.proofs for select to authenticated using(true);
create policy "Read verification history" on public.proof_verification_events for select to authenticated using(true);
revoke all on public.proofs, public.proof_verification_events from anon, authenticated;
grant select on public.proofs, public.proof_verification_events to authenticated;

create function public.create_proof(p_actor uuid,p_contribution uuid,p_post uuid,p_mission uuid,p_city uuid,p_evidence_type text,p_evidence_url text,p_evidence_description text,p_latitude numeric,p_longitude numeric,p_result text,p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_contribution public.contributions%rowtype; v_post public.posts%rowtype; v_city uuid; v_mission uuid; v_id uuid;
begin
 if auth.uid() is null or not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;
 if p_contribution is null and p_post is null then raise exception 'Select a contribution or post'; end if;
 if p_contribution is not null then
  select * into v_contribution from public.contributions where id=p_contribution;
  if not found or v_contribution.actor_id<>p_actor then raise exception 'Contribution actor mismatch'; end if;
  v_city:=v_contribution.city_id;v_mission:=v_contribution.mission_id;
 end if;
 if p_post is not null then
  select * into v_post from public.posts where id=p_post and visibility='public';
  if not found or v_post.actor_id<>p_actor then raise exception 'Post must be public and belong to actor'; end if;
  if v_mission is not null and v_post.mission_id is not null and v_mission<>v_post.mission_id then raise exception 'Mission mismatch'; end if;
  v_mission:=coalesce(v_mission,v_post.mission_id);
 end if;
 if p_mission is not null and p_mission is distinct from v_mission then raise exception 'Mission must be linked to the source'; end if;
 if v_mission is not null then
  select city_id into strict v_city from public.missions where id=v_mission and (v_city is null or city_id=v_city);
 end if;
 if p_city is not null and v_city is not null and p_city<>v_city then raise exception 'City mismatch'; end if;
 v_city:=coalesce(v_city,p_city);
 if v_city is not null and not exists(select 1 from public.places where id=v_city and source_key is not null) then raise exception 'City unavailable'; end if;
 insert into public.proofs(actor_id,contribution_id,post_id,post_snapshot,mission_id,city_id,evidence_type,evidence_url,evidence_description,latitude,longitude,result_text,occurred_on)
 values(p_actor,p_contribution,p_post,case when p_post is not null then v_post.body else null end,v_mission,v_city,p_evidence_type,p_evidence_url,p_evidence_description,p_latitude,p_longitude,p_result,p_date) returning id into v_id;
 insert into public.proof_verification_events(proof_id,previous_level,new_level,verifier_actor_id,verifier_profile_id,method,reason)
 values(v_id,null,1,p_actor,auth.uid(),'self_report','Submitted by the contributor; evidence has not been independently verified.');
 return v_id;
end $$;
revoke all on function public.create_proof(uuid,uuid,uuid,uuid,uuid,text,text,text,numeric,numeric,text,date) from public;
grant execute on function public.create_proof(uuid,uuid,uuid,uuid,uuid,text,text,text,numeric,numeric,text,date) to authenticated;

create function public.change_proof_verification(p_proof uuid,p_actor uuid,p_expected smallint,p_new smallint,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current smallint; v_owner uuid; v_grant smallint; v_method text;
begin
 if auth.uid() is null or not public.can_act_as(p_actor) then raise exception 'Not permitted'; end if;
 select verification_level,actor_id into v_current,v_owner from public.proofs where id=p_proof for update;
 if not found or v_current<>p_expected or p_new not between 1 and 4 or p_new=v_current then raise exception 'Verification has changed or is invalid'; end if;
 if public.can_act_as(v_owner) then raise exception 'Contributor cannot verify own proof'; end if;
 if p_new>v_current and p_new<>v_current+1 then raise exception 'Reviews must advance one level at a time'; end if;
 if char_length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'Explain the verification decision'; end if;
 select max_level into v_grant from public.proof_verifier_grants where profile_id=auth.uid();
 if p_new<v_current then
  if coalesce(v_grant,0)<3 then raise exception 'Authorized reviewer required to lower verification'; end if;
  v_method:='partner_review';
 elsif p_new=2 then
  v_method:='peer_attestation';
 elsif p_new=3 then
  if coalesce(v_grant,0)<3 then raise exception 'Partner reviewer authorization required'; end if;
  v_method:='partner_review';
 elsif p_new=4 then
  if coalesce(v_grant,0)<4 then raise exception 'Ground verifier authorization required'; end if;
  v_method:='ground_visit';
 end if;
 update public.proofs set verification_level=p_new where id=p_proof;
 insert into public.proof_verification_events(proof_id,previous_level,new_level,verifier_actor_id,verifier_profile_id,method,reason)
 values(p_proof,v_current,p_new,p_actor,auth.uid(),v_method,trim(p_reason));
end $$;
revoke all on function public.change_proof_verification(uuid,uuid,smallint,smallint,text) from public;
grant execute on function public.change_proof_verification(uuid,uuid,smallint,smallint,text) to authenticated;
create function public.my_proof_verifier_level() returns smallint language sql stable security definer set search_path = '' as $$
 select coalesce((select max_level from public.proof_verifier_grants where profile_id=auth.uid()),0)::smallint
$$;
revoke all on function public.my_proof_verifier_level() from public;
grant execute on function public.my_proof_verifier_level() to authenticated;
