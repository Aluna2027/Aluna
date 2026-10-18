-- PR33: atomic audited organization access mutations; service-role RPC only.
create or replace function public.aluna_audited_reject_claim(p_claim uuid,p_actor uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_org uuid; v_subject uuid;
begin
 update public.organization_claim_requests set status='rejected',decided_at=now(),decided_by=p_actor
 where id=p_claim and status in ('needs_review','dns_pending')
 returning organization_id,requester_id into v_org,v_subject;
 if v_org is null then raise exception 'Claim unavailable' using errcode='P0002'; end if;
 insert into public.organization_access_audit(organization_id,actor_id,subject_id,action)
 values(v_org,p_actor,v_subject,'claim_rejected');
 return v_org;
end $$;
create or replace function public.aluna_audited_revoke_invitation(p_invitation uuid,p_actor uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_org uuid;
begin
 update public.organization_invitations set revoked_at=now()
 where id=p_invitation and redeemed_at is null and revoked_at is null and expires_at>now()
 returning organization_id into v_org;
 if v_org is null then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 insert into public.organization_access_audit(organization_id,actor_id,action,details)
 values(v_org,p_actor,'invitation_revoked',jsonb_build_object('invitation_id',p_invitation));
 return v_org;
end $$;
create or replace function public.aluna_audited_create_domain_challenge(p_org uuid,p_domain text,p_hash text,p_actor uuid,p_expires timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.organizations where id=p_org and removed_at is null)
 then raise exception 'Organization unavailable' using errcode='P0002';end if;
 insert into public.organization_domain_challenges(organization_id,domain,challenge_hash,requested_by,expires_at)
 values(p_org,p_domain,p_hash,p_actor,p_expires) returning id into v_id;
 insert into public.organization_access_audit(organization_id,actor_id,action,details)
 values(p_org,p_actor,'domain_challenge_created',jsonb_build_object('domain',p_domain));
 return v_id;
end $$;
create or replace function public.aluna_audited_verify_domain(p_challenge uuid,p_actor uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare v_org uuid; v_domain text;
begin
 update public.organization_domain_challenges set verified_at=now()
 where id=p_challenge and verified_at is null and expires_at>now()
 returning organization_id,domain into v_org,v_domain;
 if v_org is null then raise exception 'Challenge unavailable' using errcode='P0002';end if;
 if not exists(select 1 from public.organizations where id=v_org and removed_at is null)
 then raise exception 'Organization unavailable' using errcode='P0002';end if;
 insert into public.organization_verified_domains(organization_id,domain,approved_by)
 values(v_org,v_domain,p_actor);
 insert into public.organization_access_audit(organization_id,actor_id,action,details)
 values(v_org,p_actor,'domain_verified',jsonb_build_object('domain',v_domain));
 return v_domain;
end $$;
create or replace function public.aluna_audited_revoke_domain(p_org uuid,p_domain text,p_actor uuid,p_reason text)
returns text language plpgsql security invoker set search_path='' as $$
declare v_domain text;
begin
 delete from public.organization_verified_domains where organization_id=p_org and domain=p_domain
 returning domain into v_domain;
 if v_domain is null then raise exception 'Domain unavailable' using errcode='P0002';end if;
 insert into public.organization_access_audit(organization_id,actor_id,action,details)
 values(p_org,p_actor,'domain_revoked',jsonb_build_object('domain',v_domain,'reason',p_reason));
 return v_domain;
end $$;
revoke all on function public.aluna_audited_reject_claim(uuid,uuid) from public,anon,authenticated;
revoke all on function public.aluna_audited_revoke_invitation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.aluna_audited_create_domain_challenge(uuid,text,text,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.aluna_audited_verify_domain(uuid,uuid) from public,anon,authenticated;
revoke all on function public.aluna_audited_revoke_domain(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.aluna_audited_reject_claim(uuid,uuid) to service_role;
grant execute on function public.aluna_audited_revoke_invitation(uuid,uuid) to service_role;
grant execute on function public.aluna_audited_create_domain_challenge(uuid,text,text,uuid,timestamptz) to service_role;
grant execute on function public.aluna_audited_verify_domain(uuid,uuid) to service_role;
grant execute on function public.aluna_audited_revoke_domain(uuid,text,uuid,text) to service_role;
