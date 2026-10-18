import {changeOrganizationAdminRole} from './actions';
import Link from 'next/link';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';
export default async function OrganizationAdmins({searchParams}:{searchParams:Promise<{status?:string;error?:string}>}){
 const {db}=await requireAlunaSuperAdmin();
 const {status,error:actionError}=await searchParams;
 const {data:members,error}=await db.from('organization_members').select('organization_id,profile_id,created_at').eq('member_role','admin').order('created_at',{ascending:false}).limit(500);
 const organizations=[...new Set((members??[]).map(m=>m.organization_id))];
 const people=[...new Set((members??[]).map(m=>m.profile_id))];
 const [{data:orgs},{data:profiles}]=await Promise.all([
  organizations.length?db.from('organizations').select('id,name').in('id',organizations):Promise.resolve({data:[]}),
  people.length?db.from('profiles').select('id,display_name').in('id',people):Promise.resolve({data:[]})
 ]);
 const names=new Map((orgs??[]).map(o=>[o.id,o.name]));
 const users=new Map((profiles??[]).map(p=>[p.id,p.display_name]));
 return <div className="space-y-5">
 <Link href="/aluna-admin" className="text-gold">← Aluna Administration</Link>
 <h1 className="text-3xl font-bold">Organization Admins</h1>
 <p className="text-muted">Existing assignments. Role changes stay disabled until last-administrator protection and auditing are verified.</p>
 {status&&<p role="status" className="text-gold">Organization role updated.</p>}{actionError&&<p role="alert" className="text-red-300">Role change rejected. Check the permissions, migration and last-admin protection.</p>}
 <Card title="Organization administrators">{error?<p role="alert">Unable to load administrators.</p>:(members??[]).map(m=><div key={m.organization_id+m.profile_id} className="border-b border-line py-3"><Link className="text-gold" href={`/organizations/${m.organization_id}?tab=members`}>{names.get(m.organization_id)||'Organization'}</Link><p className="text-sm">{users.get(m.profile_id)||m.profile_id}</p><form action={changeOrganizationAdminRole} className="mt-2 flex items-center gap-2"><input type="hidden" name="organization_id" value={m.organization_id}/><input type="hidden" name="profile_id" value={m.profile_id}/><input type="hidden" name="role" value="member"/><button type="submit" className="rounded-lg border border-red-700 px-3 py-2 text-sm text-red-300">Demote to member</button></form></div>)}</Card>
 </div>;
}
