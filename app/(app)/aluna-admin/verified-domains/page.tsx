import Link from 'next/link';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';
export default async function VerifiedDomains(){
 const {db}=await requireAlunaSuperAdmin();
 const {data:rows,error}=await db.from('organization_verified_domains').select('organization_id,domain,approved_at').order('approved_at',{ascending:false}).limit(100);
 const ids=[...new Set((rows??[]).map(x=>x.organization_id))];
 const {data:orgs,error:orgError}=ids.length?await db.from('organizations').select('id,name').in('id',ids):{data:[],error:null};
 const names=new Map((orgs??[]).map(o=>[o.id,o.name]));
 return <div className="space-y-5"><Link href="/aluna-admin" className="text-gold">← Aluna Administration</Link><h1 className="text-3xl font-bold">Verified Domains</h1><p className="text-muted">Official organization domain registry. No bulk imports or automatic verification are enabled. Domain enrichment for the 3,248 active organizations will take place separately after the website verification project.</p>
 <Card title="Registered organization domains">{error||orgError?<p role="alert" className="text-red-300">Cannot load verified domains.</p>:
 <div className="space-y-2">{(rows??[]).map(r=><div key={r.organization_id+r.domain} className="border-b border-line py-3"><Link className="text-gold" href={'/organizations/'+r.organization_id}>{names.get(r.organization_id)||'Organization'}</Link><p className="text-sm">{r.domain}</p><p className="text-xs text-muted">Approved {new Date(r.approved_at).toLocaleString('en-GB')}</p></div>)}{!rows?.length&&<p className="text-muted">No verified domains registered yet.</p>}</div>}</Card>
 <p className="text-xs text-muted">Domain registration, revocation and TXT challenges require a separately reviewed authority-verification workflow. This screen is read-only until those controls are accepted.</p></div>;
}
