import {safeAuthDestination} from '@/lib/auth-next';
'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {adminDb,verifiedIdentity,superAdmin,newToken,tokenHash,idPattern} from '@/lib/org-access';
import {resolveTxt} from 'node:dns/promises';

export async function claimOrganization(form:FormData){
 const identity=await verifiedIdentity();if(!identity)redirect('/login');
 const id=String(form.get('organization_id')??'');
 if(!idPattern.test(id))redirect('/organizations');
 const db=adminDb();
 const {data:org}=await db.from('organizations').select('id,removed_at').eq('id',id).maybeSingle();
 if(!org||org.removed_at)redirect('/organizations');
 const domain=identity.email.split('@')[1]??'';
 const {data:known}=await db.from('organization_verified_domains').select('domain').eq('organization_id',id).eq('domain',domain).maybeSingle();
 const {data:existingAdmin}=await db.from('organization_members').select('profile_id').eq('organization_id',id).eq('member_role','admin').limit(1);
 const status=known&&!existingAdmin?.length?'dns_pending':'needs_review';
 const challenge=status==='dns_pending'?newToken():null;
 const {error}=await db.from('organization_claim_requests').insert({
   organization_id:id,requester_id:identity.user.id,requester_email:identity.email,domain,
   status,challenge,challenge_expires_at:challenge?new Date(Date.now()+86400000).toISOString():null
 });
 if(error)redirect('/organizations/'+id+'?tab=profile&error=claim');
 revalidatePath('/organizations/'+id);
 redirect('/organizations/'+id+'?tab=profile&status=claim-pending');
}
export async function verifyClaimDns(form:FormData){
 const identity=await verifiedIdentity();if(!identity)redirect('/login');
 const claimId=String(form.get('claim_id')??'');if(!idPattern.test(claimId))redirect('/organizations');
 const db=adminDb();
 const {data:claim}=await db.from('organization_claim_requests').select('*').eq('id',claimId).eq('requester_id',identity.user.id).eq('status','dns_pending').maybeSingle();
 if(!claim||claim.requester_email!==identity.email||!claim.challenge||!claim.challenge_expires_at||new Date(claim.challenge_expires_at).getTime()<Date.now())redirect('/organizations');
 let validated=false;
 try{
   const txt=(await resolveTxt('_aluna-claim.'+claim.domain)).map(parts=>parts.join(''));
   validated=txt.includes('aluna-claim='+claim.challenge);
 }catch{return redirect('/organizations/'+claim.organization_id+'?tab=profile&error=dns');}
 if(!validated)redirect('/organizations/'+claim.organization_id+'?tab=profile&error=dns');
 const {data:granted,error}=await db.rpc('approve_first_organization_claim',{p_claim:claim.id,p_actor:identity.user.id});
 if(error||!granted)redirect('/organizations/'+claim.organization_id+'?tab=profile&error=claim');
 revalidatePath('/organizations/'+claim.organization_id);
 redirect('/organizations/'+claim.organization_id+'?tab=profile&status=claim-approved');
}
export async function decideClaim(form:FormData){
 const identity=await verifiedIdentity();if(!identity)redirect('/login');
 if(!await superAdmin(identity.client))redirect('/organizations');
 const id=String(form.get('claim_id')??''),decision=String(form.get('decision')??'');
 const returnTo='/aluna-admin/organization-access';
 if(!idPattern.test(id)||!['approve','reject'].includes(decision))redirect(returnTo+'?error=validation');
 if(decision==='approve'&&form.get('evidence_confirmed')!=='yes')redirect(returnTo+'?error=verification-required');
 const db=adminDb();
 const {data:claim,error:claimError}=await db.from('organization_claim_requests').select('id,organization_id,requester_id,status').eq('id',id).in('status',['needs_review','dns_pending']).maybeSingle();
 if(claimError||!claim)redirect(returnTo+'?error=claim');
 if(decision==='approve'){
  const {data,error}=await db.rpc('approve_first_organization_claim',{p_claim:id,p_actor:identity.user.id});
  if(error||!data)redirect(returnTo+'?error=claim');
 }else{
  const {data:rejectedOrg,error}=await db.rpc('aluna_audited_reject_claim',{p_claim:id,p_actor:identity.user.id});
  if(error||rejectedOrg!==claim.organization_id)redirect(returnTo+'?error=claim');
 }
 revalidatePath(returnTo);
 revalidatePath('/organizations/'+claim.organization_id);
 redirect(returnTo+'?status=claim-reviewed');
}
export async function createInvitation(form:FormData){
 const identity=await verifiedIdentity();if(!identity)redirect('/login');
 const org=String(form.get('organization_id')??''),email=String(form.get('email')??'').trim().toLowerCase();
 if(!idPattern.test(org)||email.length>254||! /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))redirect('/organizations?error=validation');
 const isSuper=await superAdmin(identity.client);
 const {data:member}=await identity.client.from('organization_members').select('member_role').eq('organization_id',org).eq('profile_id',identity.user.id).maybeSingle();
 if(!isSuper&&member?.member_role!=='admin')redirect('/organizations');
 const returnTo=String(form.get('return_to')??'')==='/aluna-admin/organization-access'&&isSuper?'/aluna-admin/organization-access':isSuper?'/aluna-admin':`/organizations/${org}/manage`;
 const domain=email.split('@')[1]??'';
 const personalEmailProviders=new Set(['gmail.com','googlemail.com','hotmail.com','hotmail.co.uk','outlook.com','live.com','msn.com','yahoo.com','yahoo.co.uk','icloud.com','me.com','aol.com','proton.me','protonmail.com']);
 if(personalEmailProviders.has(domain)&&(!isSuper||form.get('personal_email_review_confirmed')!=='yes'))
  redirect(returnTo+'?error=personal-email-review');
 const reviewMethod=String(form.get('review_method')??'').trim();
 const reviewNotes=String(form.get('review_notes')??'').trim();
 const allowedReviewMethods=new Set(['official_contact','official_email','official_directory','other']);
 if(isSuper&&(!allowedReviewMethods.has(reviewMethod)||reviewNotes.length<10||reviewNotes.length>1500))
  redirect(returnTo+'?error=review-required');
 const db=adminDb();
 const replacing=String(form.get('replace_invitation_id')??'');
 if(replacing){
  if(!isSuper||!idPattern.test(replacing))redirect(returnTo+'?error=invitation');
  const {data:prior,error:priorError}=await db.from('organization_invitations')
   .select('organization_id,recipient_email,redeemed_at,revoked_at,expires_at')
   .eq('id',replacing).maybeSingle();
  if(priorError||!prior||prior.organization_id!==org||prior.recipient_email.toLowerCase()!==email||
   prior.redeemed_at||prior.revoked_at||new Date(prior.expires_at)<=new Date())
    redirect(returnTo+'?error=invitation');
 }
 const {data:organization}=await db.from('organizations').select('id').eq('id',org).is('removed_at',null).maybeSingle();
 if(!organization)redirect(returnTo+'?error=organization');
 const actorId=identity.user.id;
 const token=newToken();
 const {error}=await db.from('organization_invitations').insert({organization_id:org,recipient_email:email,token_hash:tokenHash(token),invited_by:identity.user.id,expires_at:new Date(Date.now()+7*86400000).toISOString()});
 if(error)redirect(returnTo+'?error=invitation');
 async function markDeliveryFailure(reason:'email_config_missing'|'email_delivery_failed'|'resend_conflict'){
  const {data:invitation,error:lookupError}=await db.from('organization_invitations')
   .select('id').eq('token_hash',tokenHash(token)).eq('organization_id',org).maybeSingle();
  if(lookupError||!invitation)redirect(returnTo+'?error=invitation-revoke');
  const {data:revokedOrg,error}=await db.rpc('aluna_audited_invitation_delivery_failure',{
   p_invitation:invitation.id,p_actor:actorId,p_reason:reason
  });
  if(error||revokedOrg!==org)redirect(returnTo+'?error=invitation-revoke');
 }
 const site=process.env.ALUNA_SITE_URL;
 const apiKey=process.env.RESEND_API_KEY;
 const from='Aluna <notifications@notify.aluna.org>';
 const replyTo='frank@aluna.org';
 if(!site||!apiKey||!from){
  // Do not pretend an invitation was delivered; revoke it if outbound mail is not configured.
  await markDeliveryFailure('email_config_missing');
  redirect(returnTo+'?error=email-config');
 }
 const link=new URL('/organizations/invite/'+token,site).toString();
 let sent=false;
 try {
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from,reply_to:replyTo,to:email,subject:'Your Aluna organization invitation',text:'You have been invited to represent an organization on Aluna. This invitation gives you the opportunity to manage the organization profile and its activities after signing in with this email address.\n\nOpen your invitation:\n'+link+'\n\nIf you were not expecting this invitation, you can ignore this email. For questions, reply to this message.\n\nAluna Global Network'})});
  sent=res.ok;
 }catch{/* revoked below */}
 if(!sent){
  await markDeliveryFailure('email_delivery_failed');
  redirect(returnTo+'?error=invitation-email');
 }
 if(replacing){
  // Keep the old valid link until the mail provider accepts the new invitation.
  const {data:oldRevoked,error:oldError}=await db.from('organization_invitations')
   .update({revoked_at:new Date().toISOString()})
   .eq('id',replacing).eq('organization_id',org).eq('recipient_email',email)
   .is('redeemed_at',null).is('revoked_at',null)
   .gt('expires_at',new Date().toISOString()).select('id').maybeSingle();
  if(oldError||!oldRevoked){
   await markDeliveryFailure('resend_conflict');
   redirect(returnTo+'?error=resend-conflict');
  }
 }
 const {error:auditError}=await db.from('organization_access_audit').insert({
  organization_id:org,actor_id:identity.user.id,
  action:replacing?'invitation_resent':'invitation_sent',
  details:{recipient:email,...(isSuper?{review_method:reviewMethod,review_notes:reviewNotes,reviewed_by:identity.user.id}:{}),...(replacing?{replaced_invitation_id:replacing}:{})}
 });
 if(auditError)redirect(returnTo+'?error=audit');
 revalidatePath(returnTo);
 redirect(returnTo+'?status=invitation-sent');
}
export async function acceptInvitation(form:FormData){
 const identity=await verifiedIdentity();if(!identity)redirect('/login');
 const token=String(form.get('token')??'');
 if(!/^[0-9a-f]{64}$/.test(token))redirect('/organizations');
 const db=adminDb();
 const {data,error}=await db.rpc('redeem_organization_invitation',{p_hash:tokenHash(token),p_profile:identity.user.id,p_email:identity.email});
 if(error||!data)redirect('/organizations?error=invitation');
 // A redeemed invitation must not remain the user's default post-login destination.
 const saved=safeAuthDestination(String(identity.user.user_metadata?.aluna_invitation_next??''));
 if(saved==='/organizations/invite/'+token){
  await identity.client.auth.updateUser({data:{aluna_invitation_next:null}});
 }
 revalidatePath('/organizations/'+data);
 redirect('/organizations/'+data+'?tab=profile&status=invitation-accepted');
}

export async function revokeOrganizationInvitation(form:FormData){
 const identity=await verifiedIdentity();if(!identity)redirect('/login');
 if(!await superAdmin(identity.client))redirect('/organizations');
 const id=String(form.get('invitation_id')??'');
 const dest='/aluna-admin/organization-access';
 if(!idPattern.test(id))redirect(dest+'?error=validation');
 const db=adminDb();
 const {data:existing,error:lookupError}=await db.from('organization_invitations')
  .select('id,organization_id,redeemed_at,revoked_at').eq('id',id).maybeSingle();
 if(lookupError||!existing||existing.redeemed_at||existing.revoked_at)redirect(dest+'?error=invitation');
 const {data:revokedOrg,error}=await db.rpc('aluna_audited_revoke_invitation',{p_invitation:id,p_actor:identity.user.id});
 if(error||revokedOrg!==existing.organization_id)redirect(dest+'?error=invitation');
 revalidatePath(dest);
 redirect(dest+'?status=invitation-revoked');
}

export async function resendOrganizationInvitation(form:FormData){
 const identity=await verifiedIdentity();if(!identity)redirect('/login');
 if(!await superAdmin(identity.client))redirect('/organizations');
 const id=String(form.get('invitation_id')??'');
 const destination='/aluna-admin/organization-access';
 if(!idPattern.test(id))redirect(destination+'?error=validation');
 const db=adminDb();
 const {data:original,error:lookupError}=await db.from('organization_invitations')
  .select('id,organization_id,recipient_email,redeemed_at,revoked_at')
  .eq('id',id).maybeSingle();
 if(lookupError||!original||original.redeemed_at||original.revoked_at)
  redirect(destination+'?error=invitation');
 const newInvitation=new FormData();
 newInvitation.set('organization_id',original.organization_id);
 newInvitation.set('email',original.recipient_email);
 newInvitation.set('return_to',destination);
 newInvitation.set('replace_invitation_id',id);
 // Reuse the most recent recorded Super Admin review for this recipient when resending.
 const {data:reviews,error:reviewError}=await db.from('organization_access_audit')
  .select('details').eq('organization_id',original.organization_id)
  .in('action',['invitation_sent','invitation_resent'])
  .order('occurred_at',{ascending:false}).limit(100);
 if(reviewError)redirect(destination+'?error=review-required');
 const prior=(reviews??[]).map(row=>row.details as {recipient?:string;review_method?:string;review_notes?:string}|null)
  .find(details=>details !== null && details.recipient===original.recipient_email && !!details.review_method && !!details.review_notes);
 if(!prior)redirect(destination+'?error=review-required');
 newInvitation.set('review_method',prior.review_method!);
 newInvitation.set('review_notes',prior.review_notes!);
 newInvitation.set('personal_email_review_confirmed','yes');
 return createInvitation(newInvitation);
}
