import Link from 'next/link';
import { ProofList } from '@/components/proof-list';
import { Card } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

type AssignedResult={
 id:string;
 contribution_id:string;
 metric_key:string;
 verification_level:number;
 proof_id:string|null;
};
type AssignedContribution={id:string;title:string};

export default async function ProofsPage(){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 let assignedReviews:{result:AssignedResult;contribution:AssignedContribution}[]=[];
 if(user){
  // Keep completed L3 assignments discoverable after their results advance to L4.
  // Restrict to the logged-in reviewer's own, non-revoked assignments.
  const {data:assignments}=await client.from('pr43_l3_assignments')
   .select('result_id').eq('reviewer_profile_id',user.id)
   .is('revoked_at',null).order('assigned_at',{ascending:false}).limit(50);
  const ids=[...new Set((assignments??[]).map(a=>a.result_id))];
  if(ids.length){
   const {data:results}=await client.from('pr43_contribution_results')
    .select('id,contribution_id,metric_key,verification_level,proof_id').in('id',ids);
   const contributionsIds=[...new Set((results??[]).map(r=>r.contribution_id))];
   const {data:contributions}=contributionsIds.length
    ?await client.from('contributions').select('id,title').in('id',contributionsIds)
    :{data:[]};
   const resultById=new Map((results??[]).map(r=>[r.id,r as AssignedResult]));
   const contributionById=new Map((contributions??[]).map(c=>[c.id,c as AssignedContribution]));
   assignedReviews=ids.flatMap(id=>{
    const result=resultById.get(id);
    const contribution=result&&contributionById.get(result.contribution_id);
    return result&&contribution?[{result,contribution}]:[];
   });
  }
 }
 return <div className="space-y-6">
  <header><p className="deck-label">ALUNA · TRUST</p><h1 className="mt-2 text-4xl">Proofs &amp; verification</h1></header>
  {assignedReviews.length>0&&<Card title="My L3 review assignments">
   <p className="mb-4 text-sm text-muted">Revisit the Contributions and supporting evidence assigned to you, including results already verified at L4. Evidence downloads remain permission-checked.</p>
   <div className="space-y-3">{assignedReviews.map(({result,contribution})=><article key={result.id} className="rounded-xl border border-line p-4">
    <p className="text-sm font-semibold text-ink">{contribution.title}</p>
    <p className="mt-2 text-xs text-muted">{result.metric_key.replaceAll('_',' ')} · Level {result.verification_level} verified</p>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
     <Link className="text-gold hover:underline" href={`/contributions/${contribution.id}`}>View contribution &amp; evidence →</Link>
     {result.proof_id&&<Link className="text-gold hover:underline" href={`/proofs/${result.proof_id}`}>Verification history →</Link>}
     {result.verification_level===2&&<Link className="text-gold hover:underline" href={`/proofs/new?contribution=${contribution.id}`}>Complete L3 review →</Link>}
    </div>
   </article>)}</div>
  </Card>}
  <ProofList/>
 </div>;
}