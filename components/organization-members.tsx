import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { requestOrganizationMembership, reviewOrganizationMembership } from '@/app/(app)/organizations/membership-actions';

export async function OrganizationMembers({organizationId,isAdmin,managing}:{organizationId:string;isAdmin:boolean;managing:boolean}){
 const client=await createClient(); const {data:{user}}=await client.auth.getUser();
 const [{data:members,error},{data:requests}]=await Promise.all([
  client.from('organization_members').select('profile_id,member_role,profiles(display_name)').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100),
  client.from('organization_membership_requests').select('id,requester_id,status,created_at').eq('organization_id',organizationId).eq('status','pending').order('created_at',{ascending:false}).limit(100)
 ]);
 const isMember=members?.some(m=>m.profile_id===user?.id);const hasRequest=requests?.some(r=>r.requester_id===user?.id);
 const {data:profiles}=isAdmin&&requests?.length?await client.from('profiles').select('id,display_name').in('id',requests.map(r=>r.requester_id)):{data:[]};
 const names=new Map((profiles??[]).map(p=>[p.id,p.display_name]));
 return <section className="space-y-4">
  <Card title="Members"><p className="mb-4 text-sm text-muted">Approved organization members</p>
   {!isMember&&!isAdmin&&user&&(hasRequest?<p className="mb-4 text-sm text-gold">Your membership request is pending.</p>:<form action={requestOrganizationMembership} className="mb-4"><input type="hidden" name="organization_id" value={organizationId}/><button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Request membership</button></form>)}
   {error?<p role="alert">Unable to load members.</p>:<div className="space-y-3">{members?.map(member=>{const profile=member.profiles as unknown as {display_name:string}|null;return <Link key={member.profile_id} href={`/people/${member.profile_id}`} className="flex items-center gap-2 rounded-xl border border-line p-3 text-ink hover:border-gold"><span className="text-[#26E7D4]">✓</span><span>{profile?.display_name||'Member'} · {member.member_role}</span></Link>})}{!members?.length&&<p>No approved members yet.</p>}</div>}
  </Card>
  {isAdmin&&managing&&<Card title={`Membership requests (${requests?.length??0})`}><div className="space-y-3">{requests?.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3"><Link href={`/people/${r.requester_id}`} className="text-gold">{names.get(r.requester_id)||'Applicant'}</Link><div className="flex gap-2">{(['accepted','declined'] as const).map(decision=><form key={decision} action={reviewOrganizationMembership}><input type="hidden" name="organization_id" value={organizationId}/><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="decision" value={decision}/><button className="rounded-lg border border-line px-3 py-2 text-sm text-gold">{decision==='accepted'?'Accept':'Decline'}</button></form>)}</div></div>)}{!requests?.length&&<p>No membership requests pending.</p>}</div></Card>}
 </section>;
}