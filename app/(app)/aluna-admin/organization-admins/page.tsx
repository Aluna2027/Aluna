import Link from 'next/link';
import {Card} from '@/components/ui';
import {ConfirmSubmitButton} from '@/components/confirm-submit-button';
import {requireAlunaSuperAdmin,adminSearch} from '@/lib/aluna-admin';
import {changeOrganizationAdminRole} from './actions';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function OrganizationAdmins({searchParams}:{searchParams:Promise<{q?:string;organization?:string;status?:string;error?:string;archived?:string}>}){
 const {db}=await requireAlunaSuperAdmin();
 const {q:search,organization,status,error:actionError,archived}=await searchParams;
 const q=adminSearch(search),includeArchived=archived==='1';
 let searchQuery=db.from('organizations').select('id,name,removed_at')
  .order('name').limit(30);
 searchQuery=includeArchived?searchQuery.not('removed_at','is',null):searchQuery.is('removed_at',null);
 if(q)searchQuery=searchQuery.ilike('name',`%${q}%`);
 const {data:results,error:searchError}=await searchQuery;
 const selected=organization&&uuid.test(organization)?organization:null;
 const {data:org,error:orgError}=selected?await db.from('organizations').select('id,name,removed_at').eq('id',selected).maybeSingle():{data:null,error:null};
 const {data:members,error:membersError}=org?await db.from('organization_members')
  .select('profile_id,member_role,created_at').eq('organization_id',org.id).order('created_at',{ascending:true}).limit(200):{data:[],error:null};
 const ids=(members??[]).map(m=>m.profile_id);
 const {data:profiles,error:profileError}=ids.length?await db.from('profiles')
  .select('id,display_name,first_name,last_name').in('id',ids):{data:[],error:null};
 const names=new Map((profiles??[]).map(p=>[p.id,p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||'Member']));
 const adminCount=(members??[]).filter(m=>m.member_role==='admin').length;
 const blocked=Boolean(searchError||orgError||membersError||profileError);
 return <div className="space-y-6">
  <header><Link href="/aluna-admin" className="text-sm text-gold">← Aluna Administration</Link><h1 className="mt-3 text-3xl font-bold">Organization Admins</h1>
  <p className="mt-2 text-muted">Manage existing membership roles. Only active organizations can have roles changed, and the final administrator is protected.</p></header>
  {status&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Organization role updated.</p>}
  {actionError&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">The role change was not completed. Check permissions, membership and last-administrator protection.</p>}
  <Card title="Find an organization">
   <form action="/aluna-admin/organization-admins" className="flex flex-wrap gap-3">
    <input name="q" defaultValue={q} maxLength={80} placeholder="Organization name" aria-label="Search organization" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/>
    <label className="flex items-center gap-2 text-sm"><input name="archived" type="checkbox" value="1" defaultChecked={includeArchived}/>Archived only</label>
    <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Search</button>
   </form>
   {searchError?<p role="alert" className="mt-3 text-red-300">Organizations could not be loaded.</p>:
   <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">{(results??[]).map(item=><Link key={item.id} href={`/aluna-admin/organization-admins?organization=${item.id}&q=${encodeURIComponent(q)}&archived=${includeArchived?'1':'0'}`} className="block rounded-lg border border-line p-3 text-sm text-gold hover:bg-panel-raised">{item.name}{item.removed_at?' · Archived':''}</Link>)}{!results?.length&&<p className="text-muted">No organizations found.</p>}</div>}
   {results?.length===30&&<p className="mt-2 text-xs text-muted">Showing the first 30 matches. Narrow your search to find other organizations.</p>}
  </Card>
  {selected&&!org&&!orgError&&<p role="alert" className="text-red-300">Organization not found.</p>}
  {org&&<Card title={`Members — ${org.name}`}>
   {blocked?<p role="alert" className="text-red-300">Membership data could not be loaded; actions are unavailable.</p>:<>
    <p className="mb-4 text-sm text-muted">{adminCount} Organization Admin{adminCount===1?'':'s'} · {members?.length??0} visible members{org.removed_at?' · Archived: roles cannot be changed':''}.</p>
    <div className="space-y-3">{(members??[]).map(member=><div key={member.profile_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
     <div><p className="font-semibold">{names.get(member.profile_id)||'Member'}</p><p className="text-xs text-muted">{member.member_role==='admin'?'Organization Admin':'Member'} · {member.profile_id}</p></div>
     {!org.removed_at&&<form action={changeOrganizationAdminRole}>
      <input type="hidden" name="organization_id" value={org.id}/>
      <input type="hidden" name="profile_id" value={member.profile_id}/>
      <input type="hidden" name="role" value={member.member_role==='admin'?'member':'admin'}/>
      {member.member_role==='admin'&&adminCount===1?<span className="text-xs text-muted">Last administrator — protected</span>:
       <ConfirmSubmitButton message={member.member_role==='admin'?'Demote this administrator to member?':'Promote this member to Organization Admin?'} className={member.member_role==='admin'?'rounded-lg border border-red-700 px-4 py-2 text-sm text-red-300':'rounded-lg border border-gold px-4 py-2 text-sm text-gold'}>{member.member_role==='admin'?'Demote to member':'Promote to admin'}</ConfirmSubmitButton>}
     </form>}
    </div>)}{!members?.length&&<p className="text-muted">This organization has no registered members. Representatives must first join or accept an authorized invitation.</p>}</div>
    {(members?.length??0)===200&&<p role="status" className="mt-3 text-xs text-muted">Only the first 200 members are shown; search/pagination required before editing larger memberships.</p>}
   </>}
  </Card>}
 </div>;
}
