import Link from 'next/link';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin,adminSearch} from '@/lib/aluna-admin';
export default async function AdminAudit({searchParams}:{searchParams:Promise<{q?:string}>}){
 const {db}=await requireAlunaSuperAdmin();
 const {q:raw}=await searchParams,q=adminSearch(raw).toLowerCase();
 const [{data:access,error:accessError},{data:changes,error:changesError}]=await Promise.all([
  db.from('organization_access_audit').select('id,organization_id,actor_id,subject_id,action,occurred_at').order('occurred_at',{ascending:false}).limit(100),
  db.from('organization_admin_audit').select('id,organization_id,organization_name,performed_by,action,occurred_at').order('occurred_at',{ascending:false}).limit(100)
 ]);
 const ids=[...new Set([...(access??[]).map(a=>a.organization_id),...(changes??[]).map(a=>a.organization_id)])];
 const {data:orgs,error:orgError}=ids.length?await db.from('organizations').select('id,name').in('id',ids):{data:[],error:null};
 const names=new Map((orgs??[]).map(o=>[o.id,o.name]));
 const records=[
 ...(access??[]).map(r=>({key:'access-'+r.id,organizationId:r.organization_id,organization:names.get(r.organization_id)||'Organization',action:r.action,when:r.occurred_at,source:'Access'})),
 ...(changes??[]).map(r=>({key:'organization-'+r.id,organizationId:r.organization_id,organization:r.organization_name||names.get(r.organization_id)||'Organization',action:r.action,when:r.occurred_at,source:'Organization'}))
 ].sort((a,b)=>b.when.localeCompare(a.when));
 const shown=q?records.filter(r=>(r.organization+' '+r.action+' '+r.source).toLowerCase().includes(q)):records;
 return <div className="space-y-5"><Link href="/aluna-admin" className="text-gold">← Aluna Administration</Link><h1 className="text-3xl font-bold">Audit Log</h1><p className="text-muted">Combined organization and access-management history. The latest 100 entries per audit source are shown.</p>
 <Card title="Filter recent activity"><form action="/aluna-admin/audit" className="flex gap-3"><input name="q" aria-label="Search audit activity" maxLength={80} defaultValue={q} placeholder="Organization or action" className="min-w-0 flex-1 rounded-lg border border-line bg-panel-raised p-3"/><button className="rounded-lg bg-gold px-4 py-2 text-navy">Filter</button></form></Card>
 {(accessError||changesError||orgError)?<p role="alert" className="text-red-300">Audit history unavailable. No partial history displayed.</p>:
 <Card title="Recent audit activity"><div className="space-y-2">{shown.map(r=><div key={r.key} className="flex flex-wrap justify-between gap-3 border-b border-line py-3 text-sm"><div><p className="text-xs text-muted">{r.source} · {r.action}</p><p className="font-semibold text-ink">{r.organization}</p><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1"><Link className="text-gold" href={'/organizations/'+r.organizationId}>Organization Profile</Link><Link className="text-gold" href={'/aluna-admin/organization-admins/'+r.organizationId}>Manage Organization Admins</Link></div></div><time className="text-xs text-muted">{new Date(r.when).toLocaleString('en-GB')}</time></div>)}{!shown.length&&<p className="text-muted">No records match the filter.</p>}</div></Card>}
 </div>;
}
