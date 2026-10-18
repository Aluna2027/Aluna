-- PR #33: revoke failed-delivery invitations and record their audit atomically.
-- Called only by the existing server-side service-role action after delivery failure.
create or replace function public.aluna_audited_invitation_delivery_failure(
 p_invitation uuid,p_actor uuid,p_reason text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_org uuid;
begin
 if p_reason not in ('email_config_missing','email_delivery_failed','resend_conflict')
 then raise exception 'Invalid failure reason' using errcode='22023'; end if;
 update public.organization_invitations set revoked_at=now()
 where id=p_invitation and revoked_at is null and redeemed_at is null
 returning organization_id into v_org;
 if v_org is null then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 insert into public.organization_access_audit(organization_id,actor_id,action,details)
 values(v_org,p_actor,'invitation_delivery_failed',jsonb_build_object('invitation_id',p_invitation,'reason',p_reason));
 return v_org;
end $$;
revoke all on function public.aluna_audited_invitation_delivery_failure(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.aluna_audited_invitation_delivery_failure(uuid,uuid,text) to service_role;
