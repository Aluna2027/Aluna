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
 const {data:created,error}=await db.rpc('aluna_audited_create_domain_challenge',{p_org:org,p_domain:domain,p_hash:tokenHash(token),p_actor:user.id,p_expires:new Date(Date.now()+24*3600000).toISOString()});
 if(error||!created)redirect(dest+'?error=challenge');
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
 const {data:verified,error:verifyError}=await db.rpc('aluna_audited_verify_domain',{p_challenge:challenge.id,p_actor:user.id});
 if(verifyError||verified!==challenge.domain)redirect(dest+'?error=save');
 revalidatePath(dest);
 redirect(dest+'?status=verified');
}
export async function revokeVerifiedDomain(form:FormData){
 const org=String(form.get('organization_id')??''),domain=String(form.get('domain')??'').trim().toLowerCase(),reason=String(form.get('reason')??'').trim();
 if(!uuid.test(org)||!validDomain.test(domain)||reason.length<8||reason.length>500)redirect(dest+'?error=validation');
 const {user,db}=await requireAlunaSuperAdmin();
 const {data:revoked,error}=await db.rpc('aluna_audited_revoke_domain',{p_org:org,p_domain:domain,p_actor:user.id,p_reason:reason});
 if(error||revoked!==domain)redirect(dest+'?error=revoke');
 revalidatePath(dest);
 redirect(dest+'?status=revoked');
}
