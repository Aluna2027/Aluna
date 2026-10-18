import Link from 'next/link';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin,adminSearch} from '@/lib/aluna-admin';
export default async function OrganizationAdmins({searchParams}:{searchParams:Promise<{q?:string;archived?:string;status?:string;error?:string}>}){
 const {db}=await requireAlunaSuperAdmin();
 const {q:search,archived,status,error:actionError}=await searchParams;
 const q=adminSearch(search),includeArchived=archived==='1';
 let query=db.from('organizations').select('id,name,removed_at').order('name').limit(30);
 query=includeArchived?query.not('removed_at','is',null):query.is('removed_at',null);
 if(q)query=query.ilike('name',`%${q}%`);
 const {data:results,error}=await query;
 return <div className="space-y-6">
 <header><Link href="/aluna-admin" className="text-sm text-gold">← Aluna Administration</Link><h1 className="mt-3 text-3xl font-bold">Organization Admins</h1>
 <p className="mt-2 text-muted">Select an organization to view and manage its existing membership roles. The final administrator is protected.</p></header>
 {status&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Organization role updated.</p>}
 {actionError&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">The role change was not completed. Check permissions, membership and last-administrator protection.</p>}
 <Card title="Find an organization">
 <form action="/aluna-admin/organization-admins" className="flex flex-wrap gap-3">
 <input name="q" defaultValue={q} maxLength={80} placeholder="Organization name" aria-label="Search organization" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/>
 <label className="flex items-center gap-2 text-sm"><input name="archived" type="checkbox" value="1" defaultChecked={includeArchived}/>Archived only</label>
 <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Search</button>
 </form>
 {error?<p role="alert" className="mt-3 text-red-300">Organizations could not be loaded.</p>:
 <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">{(results??[]).map(item=><Link key={item.id} href={`/aluna-admin/organization-admins/${item.id}`} className="block rounded-lg border border-line p-3 text-sm text-gold hover:bg-panel-raised">{item.name}{item.removed_at?' · Archived':''}</Link>)}{!results?.length&&<p className="text-muted">No organizations found.</p>}</div>}
 {results?.length===30&&<p className="mt-2 text-xs text-muted">Showing the first 30 matches. Narrow your search to find other organizations.</p>}
 </Card>
 </div>;
}
