import Link from 'next/link';
import { ShieldCheck, TrendingUp } from 'lucide-react';
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
  <section id="proofs"><ProofList actorId={actorId} iconColor={iconColors.proofs}/></section>
  <section id="verification"><Card title={<span className="flex items-center gap-3"><ShieldCheck size={24} color={iconColors.verification}/>Verification</span>}><p>Proof reviews show the reviewer, method, reason and complete level history on each proof.</p><p className="mt-3 text-sm text-muted">{levels.filter(r=>r.verification_level>=3).length} verified (L3/L4) · {levels.filter(r=>r.verification_level<3).length} reported (L1/L2). Verification is not implied by an uploaded proof.</p><Link href="#proofs" className="mt-4 inline-block text-gold">View organization proofs →</Link></Card></section>
  <section id="contributions"><ContributionList actorId={actorId} iconColor={iconColors.missions}/></section>
  <section id="impact"><div className="mb-4 flex items-center gap-3 text-lg font-semibold text-ink"><TrendingUp size={24} color={iconColors.impact}/>Impact</div><ImpactView scope={{actorId}} metricIconColor={iconColors.impact}/></section>
 </section>;
}
