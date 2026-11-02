import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {Card} from '@/components/ui';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Candidate={profileId:string;actorId:string;name:string;organization:string};

async function assignL3(formData:FormData){
 'use server';
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login');
 const {data:isAdmin,error:authError}=await client.rpc('is_aluna_admin');
 if(authError||!isAdmin)redirect('/proofs');
 const result=String(formData.get('result')??'');
 const selection=String(formData.get('reviewer')??'');
 const [profile,actor,...extra]=selection.split('|');
 if(!uuid.test(result)||!uuid.test(profile??'')||!uuid.test(actor??'')||extra.length){
  redirect('/proofs/l3-admin?status=invalid');
 }
 // The RPC independently validates L2 status, accreditation, organization
 // membership, absence of conflict, and the identity of the assigning admin.
 const {error}=await client.rpc('pr43_assign_l3',{
  p_result:result,p_reviewer_profile:profile,p_reviewer_actor:actor,
 });
 if(error)redirect('/proofs/l3-admin?status=rejected');
 redirect('/proofs/l3-admin?status=assigned');
}

export default async function L3Assignments({searchParams}:{
 searchParams:Promise<{status?:string}>
}){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login');
 const {data:isAdmin,error:authError}=await client.rpc('is_aluna_admin');
 if(authError||!isAdmin)redirect('/proofs');
 const [{data:results,error:resultsError},{data:members,error:membersError}]=await Promise.all([
  client.from('pr43_contribution_results').select('id,contribution_id,metric_key,quantity')
   .eq('verification_level',2).order('created_at',{ascending:false}).limit(100),
  client.from('organization_members').select('profile_id,organization_id')
   .eq('member_role','admin').limit(500),
 ]);
 const resultRows=results??[];
 const memberRows=members??[];
 const contributionIds=[...new Set(resultRows.map(r=>r.contribution_id))];
 const profileIds=[...new Set(memberRows.map(m=>m.profile_id))];
 const orgIds=[...new Set(memberRows.map(m=>m.organization_id))];
 const [{data:contributions},{data:profiles},{data:organizations},{data:orgActors}]=await Promise.all([
  contributionIds.length?client.from('contributions').select('id,title').in('id',contributionIds):Promise.resolve({data:[]}),
  profileIds.length?client.from('profiles').select('id,display_name').in('id',profileIds):Promise.resolve({data:[]}),
  orgIds.length?client.from('organizations').select('id,name,removed_at').in('id',orgIds):Promise.resolve({data:[]}),
  orgIds.length?client.from('actors').select('id,organization_id').in('organization_id',orgIds):Promise.resolve({data:[]}),
 ]);
 const contributionNames=new Map((contributions??[]).map(x=>[x.id,x.title]));
 const profileNames=new Map((profiles??[]).map(x=>[x.id,x.display_name]));
 const organizationNames=new Map((organizations??[]).filter(x=>!x.removed_at).map(x=>[x.id,x.name]));
 const actorIds=new Map((orgActors??[]).map(x=>[x.organization_id,x.id]));
 const candidates:Candidate[]=memberRows.flatMap(m=>{
  const actorId=actorIds.get(m.organization_id),organization=organizationNames.get(m.organization_id);
  if(!actorId||!organization)return [];
  return [{profileId:m.profile_id,actorId,name:profileNames.get(m.profile_id)??'Organization administrator',organization}];
 });
 const status=(await searchParams).status;
 return <div className="space-y-5">
  <Link href="/proofs/new" className="text-sm text-gold">← Proofs &amp; Verification</Link>
  <Card title="L3 — Independent reviewer assignment">
   <p className="mb-4 text-sm text-muted">Aluna administrators can assign an accredited, independent organization reviewer to an L2-verified contribution. Assignment is checked and recorded server-side.</p>
   {status==='assigned'&&<p role="status" className="mb-4 rounded-lg border border-[#26E7D4] p-3 text-sm text-[#26E7D4]">L3 reviewer assignment saved successfully.</p>}
   {status==='invalid'&&<p role="alert" className="mb-4 rounded-lg border border-red-700 p-3 text-sm text-red-300">Select a valid contribution and reviewer.</p>}
   {status==='rejected'&&<p role="alert" className="mb-4 rounded-lg border border-red-700 p-3 text-sm text-red-300">Assignment rejected. Confirm L3 accreditation, organization independence, and reviewer eligibility.</p>}
   {(resultsError||membersError)&&<p role="alert" className="mb-4 text-red-300">Could not load assignment options.</p>}
   <form action={assignL3} className="max-w-3xl space-y-4">
    <label className="block text-sm">L2-verified contribution
     <select name="result" required defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">
      <option value="" disabled>Choose a contribution result</option>
      {resultRows.map(r=><option key={r.id} value={r.id}>{contributionNames.get(r.contribution_id)??r.contribution_id} · {r.metric_key} · reported {r.quantity}</option>)}
     </select>
    </label>
    <label className="block text-sm">Organization reviewer (must have L3 accreditation)
     <select name="reviewer" required defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">
      <option value="" disabled>Choose a separate organization administrator</option>
      {candidates.map(c=><option key={c.profileId+'|'+c.actorId} value={c.profileId+'|'+c.actorId}>{c.name} · {c.organization}</option>)}
     </select>
    </label>
    <button type="submit" disabled={!resultRows.length||!candidates.length||Boolean(resultsError||membersError)} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Assign independent L3 reviewer</button>
   </form>
   <p className="mt-4 text-xs text-muted">An organization-admin role alone is not L3 accreditation. The server rejects self-assignment and project or organization conflicts. This page does not perform the L3 verification itself.</p>
  </Card>
 </div>;
}
