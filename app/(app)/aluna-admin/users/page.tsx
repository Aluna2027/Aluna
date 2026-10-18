import Link from 'next/link';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin,adminSearch} from '@/lib/aluna-admin';

export default async function AdminUsers({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const {db}=await requireAlunaSuperAdmin();
 const params=await searchParams;
 const q=adminSearch(params.q);
 const page=Math.min(200,Math.max(0,parseInt(params.page??'0',10)||0));
 let query=db.from('profiles').select('id,display_name,first_name,last_name,created_at,onboarded_at,aluna_role',{count:'exact'})
  .order('created_at',{ascending:false}).range(page*25,page*25+24);
 if(q)query=query.or(`display_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
 const {data:users,error,count}=await query;
 const ids=(users??[]).map(u=>u.id);
 const [{data:memberships,error:membersError},{data:superAdmins,error:adminsError}]=await Promise.all([
  ids.length?db.from('organization_members').select('organization_id,profile_id,member_role').in('profile_id',ids).limit(1000):Promise.resolve({data:[],error:null}),
  db.from('aluna_super_admins').select('profile_id')
 ]);
 const orgIds=[...new Set((memberships??[]).map(x=>x.organization_id))];
 const {data:orgs,error:orgError}=orgIds.length?await db.from('organizations').select('id,name').in('id',orgIds):{data:[],error:null};
 const organizations=new Map((orgs??[]).map(o=>[o.id,o.name]));
 const admins=new Set((superAdmins??[]).map(a=>a.profile_id));
 const blocked=Boolean(error||membersError||adminsError||orgError);
 return <div className="space-y-5">
  <header><Link href="/aluna-admin" className="text-sm text-gold">← Aluna Administration</Link><h1 className="mt-3 text-3xl font-bold">User Profiles</h1><p className="text-muted">Account lookup, onboarding, organization memberships and Aluna access roles. Read-only until the suspension and retention controls pass security acceptance.</p></header>
  <Card title="Find user profiles"><form action="/aluna-admin/users" className="flex flex-wrap gap-3"><input aria-label="Search users" name="q" defaultValue={q} maxLength={80} placeholder="Name or display name" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/><button type="submit" className="rounded-xl bg-gold px-5 font-semibold text-navy">Search</button></form></Card>
  {blocked?<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">The requested profile or membership records could not be loaded. No account actions are available.</p>:<>
   <Card title={`User Profiles (${count??0})`}>
    <div className="space-y-3">{(users??[]).map(user=><article key={user.id} className="rounded-xl border border-line p-4">
     <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{user.display_name||[user.first_name,user.last_name].filter(Boolean).join(' ')||'Unnamed member'}</p><p className="text-xs text-muted">{user.id}</p></div><span className="text-xs text-gold">{admins.has(user.id)?'Aluna Super Admin':'Member'}</span></div>
     <p className="mt-2 text-sm text-muted">{user.onboarded_at?'Onboarding completed':'Onboarding not completed'} · Joined {new Date(user.created_at).toLocaleDateString('en-GB')}</p>
     <div className="mt-2 flex flex-wrap gap-2">{(memberships??[]).filter(m=>m.profile_id===user.id).map(m=><Link key={m.organization_id} href={`/organizations/${m.organization_id}?tab=members`} className="rounded-lg border border-line px-2 py-1 text-xs text-gold">{organizations.get(m.organization_id)??'Organization'} · {m.member_role}</Link>)}</div>
    </article>)}{!users?.length&&<p className="text-muted">No users match this search.</p>}</div>
   </Card>
   <div className="flex justify-between text-sm">{page>0?<Link href={`/aluna-admin/users?q=${encodeURIComponent(q)}&page=${page-1}`} className="text-gold">← Previous</Link>:<span/>}{(count??0)>(page+1)*25&&<Link href={`/aluna-admin/users?q=${encodeURIComponent(q)}&page=${page+1}`} className="text-gold">Next →</Link>}</div>
  </>}
 </div>;
}
