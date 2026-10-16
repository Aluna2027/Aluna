import { HandHeart, FileCheck2, ShieldCheck, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ImpactView } from '@/components/impact-view';
import { createClient } from '@/lib/supabase/server';

export async function OrganizationImpact({actorId}:{actorId:string}){
 const client=await createClient();
 const {data:verified}=await client.from('proofs').select('verification_level').eq('actor_id',actorId).limit(500);
 const levels=verified??[];
 return <section className="space-y-5">
  <div className="flex items-center gap-2"><HandHeart size={24} className="text-[#26E7D4]"/><h2 className="text-xl font-semibold">Contributions</h2></div>
  <ContributionList actorId={actorId}/>
  <div className="flex items-center gap-2"><FileCheck2 size={24} className="text-[#26E7D4]"/><h2 className="text-xl font-semibold">Proofs</h2></div>
  <ProofList actorId={actorId}/>
  <div className="rounded-xl border border-line bg-panel p-5"><h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck size={24} className="text-[#26E7D4]"/>Verification</h2><p className="mt-3 text-sm text-muted">{levels.filter(r=>r.verification_level>=3).length} verified (L3/L4) · {levels.filter(r=>r.verification_level<3).length} reported (L1/L2). Verification is not implied by an uploaded proof.</p></div>
  <div className="flex items-center gap-2"><ChartNoAxesColumnIncreasing size={24} className="text-[#26E7D4]"/><h2 className="text-xl font-semibold">Impact</h2></div>
  <ImpactView scope={{actorId}}/>
 </section>;
}
