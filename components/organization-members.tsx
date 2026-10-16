import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';

export async function OrganizationMembers({organizationId,isAdmin,managing}:{organizationId:string;isAdmin:boolean;managing:boolean}){
 const client=await createClient();
 const {data:members,error}=await client.from('organization_members').select('profile_id,member_role,profiles(display_name)').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);
 return <section className="space-y-4">
  <Card title="Members"><div className="mb-4 flex items-center gap-2 text-[#26E7D4]"><UsersRound size={23}/><span className="text-sm text-muted">Approved organization representatives</span></div>
   {error?<p role="alert">Unable to load members.</p>:<div className="space-y-3">{members?.map(member=>{const profile=member.profiles as unknown as {display_name:string}|null;return <Link key={member.profile_id} href={`/people/${member.profile_id}`} className="flex items-center gap-2 rounded-xl border border-line p-3 text-ink hover:border-gold"><span className="text-[#26E7D4]">✓</span><span>{profile?.display_name||'Member'} · {member.member_role}</span></Link>})}{!members?.length&&<p>No approved members yet.</p>}</div>}
  </Card>
  {isAdmin&&managing&&<Card title="Manage Members"><p className="text-sm text-muted">Administrator invitations and organization access remain managed through the existing protected workflow.</p><Link className="mt-3 inline-block text-gold" href={`/organizations/${organizationId}/manage`}>Open Organization Management →</Link></Card>}
 </section>;
}
