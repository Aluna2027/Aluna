import Link from 'next/link';
import {cookies} from 'next/headers';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';
import {requestDomainVerification,verifyOrganizationDomain,revokeVerifiedDomain} from './actions';
import {ConfirmSubmitButton} from '@/components/confirm-submit-button';
export default async function VerifiedDomains({searchParams}:{searchParams:Promise<{status?:string;error?:string;domain?:string;token?:string}>}){
 const {db}=await requireAlunaSuperAdmin();
 const params=await searchParams;
 const preview= (await cookies()).get('aluna-domain-challenge-preview')?.value;
 let challengePreview:{domain:string;token:string}|null=null;
 try{if(preview)challengePreview=JSON.parse(preview);}catch{/* ignored */}
 const [{data:rows,error},{data:challenges,error:challengesError}]=await Promise.all([
  db.from('organization_verified_domains').select('organization_id,domain,approved_at').order('approved_at',{ascending:false}).limit(100),
  db.from('organization_domain_challenges').select('id,organization_id,domain,requested_at,expires_at,verified_at').is('verified_at',null).gt('expires_at',new Date().toISOString()).order('requested_at',{ascending:false}).limit(25)
 ]);
 const ids=[...new Set([...(rows??[]).map(x=>x.organization_id),...(challenges??[]).map(x=>x.organization_id)])];
 const {data:orgs,error:orgError}=ids.length?await db.from('organizations').select('id,name').in('id',ids):{data:[],error:null};
 const names=new Map((orgs??[]).map(o=>[o.id,o.name]));
 const blocked=!!error||!!challengesError||!!orgError;
 return <div className="space-y-5"><Link href="/aluna-admin" className="text-gold">← Aluna Administration</Link><h1 className="text-3xl font-bold">Verified Domains</h1><p className="text-muted">Only verify domains after confirming the organization&apos;s authority and a live DNS TXT proof. The 3,248-organization website enrichment project remains separate.</p>
 {params.status&&<p role="status" className="text-gold">Domain action: {params.status}</p>}{params.error&&<p role="alert" className="text-red-300">Domain action failed: {params.error}</p>}
 {challengePreview&&<Card title="New DNS verification challenge"><p>Publish a TXT record at <strong>{'_aluna-verify.'+challengePreview.domain}</strong> with the exact value below. The challenge expires after 24 hours. Store the token securely; it is not displayed again.</p><code className="mt-3 block break-all rounded-lg border border-line p-3">{'aluna-verify='+challengePreview.token}</code></Card>}
 {blocked?<p role="alert" className="text-red-300">Cannot load domain records; management actions are unavailable.</p>:<>
 <Card title="Start DNS verification"><form action={requestDomainVerification} className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Organization ID<input name="organization_id" required placeholder="Organization UUID" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label><label className="text-sm">Official domain<input name="domain" required placeholder="example.org" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label><button className="rounded-xl bg-gold p-3 font-semibold text-navy sm:col-span-2">Create DNS challenge</button></form></Card>
 <Card title="Pending DNS challenges"><div className="space-y-4">{(challenges??[]).map(x=><div key={x.id} className="rounded-xl border border-line p-4"><p className="font-semibold">{names.get(x.organization_id)||'Organization'} · {x.domain}</p><p className="my-2 text-xs text-muted">Expires {new Date(x.expires_at).toLocaleString('en-GB')}</p><form action={verifyOrganizationDomain} className="flex flex-wrap gap-2"><input type="hidden" name="challenge_id" value={x.id}/><input name="token" placeholder="64-character challenge token" required minLength={64} maxLength={64} className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-2"/><button className="rounded-lg border border-gold px-3 py-2 text-gold">Verify TXT</button></form></div>)}{!challenges?.length&&<p className="text-muted">No pending DNS verification challenges.</p>}</div></Card>
 <Card title="Registered organization domains"><div className="space-y-3">{(rows??[]).map(x=><div key={x.organization_id+x.domain} className="rounded-xl border border-line p-4"><Link className="text-gold" href={'/organizations/'+x.organization_id}>{names.get(x.organization_id)||'Organization'}</Link><p className="text-sm">{x.domain}</p><p className="text-xs text-muted">Verified {new Date(x.approved_at).toLocaleString('en-GB')}</p><form action={revokeVerifiedDomain} className="mt-2 flex flex-wrap gap-2"><input type="hidden" name="organization_id" value={x.organization_id}/><input type="hidden" name="domain" value={x.domain}/><input name="reason" required minLength={8} maxLength={500} placeholder="Reason for revocation" className="min-w-0 flex-1 rounded-lg border border-line bg-panel-raised p-2 text-sm"/><ConfirmSubmitButton message="Revoke this verified domain? This may change pending claims." className="rounded-lg border border-red-700 px-3 text-sm text-red-300">Revoke</ConfirmSubmitButton></form></div>)}{!rows?.length&&<p className="text-muted">No verified domains registered.</p>}</div></Card>
 </>}
 </div>;
}
