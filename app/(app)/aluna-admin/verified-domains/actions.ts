'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {resolveTxt} from 'node:dns/promises';
import {cookies} from 'next/headers';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';
import {newToken,tokenHash} from '@/lib/org-access';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validDomain=/^[a-z0-9](?:[a-z0-9.-]{1,251}[a-z0-9])?$/;
const dest='/aluna-admin/verified-domains';
export async function requestDomainVerification(form:FormData){
 const org=String(form.get('organization_id')??''),domain=String(form.get('domain')??'').trim().toLowerCase();
 if(!uuid.test(org)||!validDomain.test(domain)||!domain.includes('.')||domain.includes('..')||domain.startsWith('www.')||domain.length>253)redirect(dest+'?error=validation');
 const {user,db}=await requireAlunaSuperAdmin();
 const {data:organization,error:orgError}=await db.from('organizations').select('id').eq('id',org).is('removed_at',null).maybeSingle();
 if(orgError||!organization)redirect(dest+'?error=organization');
 const {data:already,error:existingError}=await db.from('organization_verified_domains').select('organization_id').eq('domain',domain).limit(1);
 if(existingError||already?.length)redirect(dest+'?error=already-registered');
 const token=newToken();
 const {error}=await db.from('organization_domain_challenges').insert({
  organization_id:org,domain,challenge_hash:tokenHash(token),requested_by:user.id,expires_at:new Date(Date.now()+24*3600000).toISOString()
 });
 if(error)redirect(dest+'?error=challenge');
 const {error:auditError}=await db.from('organization_access_audit').insert({organization_id:org,actor_id:user.id,action:'domain_challenge_created',details:{domain}});
 if(auditError)redirect(dest+'?error=audit');
 // The one-time token is only shown at creation; only its hash is saved.
 // Display once via a short-lived secure, HTTP-only cookie, never via the URL.
 const jar=await cookies();
 jar.set('aluna-domain-challenge-preview',JSON.stringify({domain,token}),{
  httpOnly:true,secure:true,sameSite:'strict',path:dest,maxAge:300
 });
 revalidatePath(dest);
 redirect(dest+'?status=challenge-created');
}
export async function verifyOrganizationDomain(form:FormData){
 const id=String(form.get('challenge_id')??'');
 const token=String(form.get('token')??'').trim();
 if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(token))redirect(dest+'?error=validation');
 const {user,db}=await requireAlunaSuperAdmin();
 const {data:challenge,error}=await db.from('organization_domain_challenges').select('*').eq('id',id).maybeSingle();
 if(error||!challenge||challenge.verified_at||new Date(challenge.expires_at)<=new Date()||challenge.challenge_hash!==tokenHash(token))redirect(dest+'?error=challenge');
 const {data:organization}=await db.from('organizations').select('id').eq('id',challenge.organization_id).is('removed_at',null).maybeSingle();
 if(!organization)redirect(dest+'?error=organization');
 let ok=false;
 try{const records=await resolveTxt('_aluna-verify.'+challenge.domain);ok=records.map(x=>x.join('')).includes('aluna-verify='+token);}catch{/* DNS not ready */}
 if(!ok)redirect(dest+'?error=dns');
 const {data:existing}=await db.from('organization_verified_domains').select('organization_id').eq('domain',challenge.domain).limit(1);
 if(existing?.length)redirect(dest+'?error=already-registered');
 const {error:insertError}=await db.from('organization_verified_domains').insert({organization_id:challenge.organization_id,domain:challenge.domain,approved_by:user.id});
 if(insertError)redirect(dest+'?error=save');
 await db.from('organization_domain_challenges').update({verified_at:new Date().toISOString()}).eq('id',challenge.id).is('verified_at',null);
 await db.from('organization_access_audit').insert({organization_id:challenge.organization_id,actor_id:user.id,action:'domain_verified',details:{domain:challenge.domain}});
 revalidatePath(dest);
 redirect(dest+'?status=verified');
}
export async function revokeVerifiedDomain(form:FormData){
 const org=String(form.get('organization_id')??''),domain=String(form.get('domain')??'').trim().toLowerCase(),reason=String(form.get('reason')??'').trim();
 if(!uuid.test(org)||!validDomain.test(domain)||reason.length<8||reason.length>500)redirect(dest+'?error=validation');
 const {user,db}=await requireAlunaSuperAdmin();
 const {data:deleted,error}=await db.from('organization_verified_domains').delete().eq('organization_id',org).eq('domain',domain).select('domain').maybeSingle();
 if(error||!deleted)redirect(dest+'?error=revoke');
 await db.from('organization_access_audit').insert({organization_id:org,actor_id:user.id,action:'domain_revoked',details:{domain,reason}});
 revalidatePath(dest);
 redirect(dest+'?status=revoked');
}
