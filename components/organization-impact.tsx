import { ChartNoAxesColumnIncreasing } from 'lucide-react';
import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ImpactView } from '@/components/impact-view';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { iconColors } from '@/lib/icon-colors';

export async function OrganizationImpact({actorId}:{actorId:string}){
 const client=await createClient();
 const {data:verified}=await client.from('proofs').select('verification_level').eq('actor_id',actorId).limit(500);
 const levels=verified??[];
 return <section className="space-y-5">
  <ContributionList actorId={actorId} iconColor={iconColors.impact}/>
  <ProofList actorId={actorId} iconColor={iconColors.impact}/>
  <Card iconColor={iconColors.impact} title="Verification"><p className="mt-3 text-sm text-muted">{levels.filter(r=>r.verification_level>=3).length} verified (L3/L4) · {levels.filter(r=>r.verification_level<3).length} reported (L1/L2). Verification is not implied by an uploaded proof.</p></Card>
  <div className="flex items-center gap-2"><ChartNoAxesColumnIncreasing size={24} color={iconColors.impact}/><h2 className="text-xl font-semibold">Impact</h2></div>
  <ImpactView scope={{actorId}} iconColor={iconColors.impact}/>
 </section>;
}
