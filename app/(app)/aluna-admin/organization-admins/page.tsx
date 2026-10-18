import Link from 'next/link';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';
export default async function OrganizationAdmins(){
 const {db}=await requireAlunaSuperAdmin();
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
 <Card title="Organization administrators">{error?<p role="alert">Unable to load administrators.</p>:(members??[]).map(m=><div key={m.organization_id+m.profile_id} className="border-b border-line py-3"><Link className="text-gold" href={`/organizations/${m.organization_id}?tab=members`}>{names.get(m.organization_id)||'Organization'}</Link><p className="text-sm">{users.get(m.profile_id)||m.profile_id}</p></div>)}</Card>
 </div>;
}
