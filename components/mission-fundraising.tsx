import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { campaignTotal, Progress, type Total } from '@/lib/fundraising';
import { money } from '@/lib/missions';
export async function MissionFundraising({missionId}:{missionId:string}){
 const client=await createClient();
 const [{data:mission},{data:campaigns},{data:totalRows}]=await Promise.all([
  client.from('missions').select('funding_goal_amount,currency_code').eq('id',missionId).maybeSingle(),
  client.from('fundraising_campaigns').select('id,title,story,goal_amount,currency_code').eq('mission_id',missionId).is('removed_at',null).is('archived_at',null).order('created_at',{ascending:false}).limit(100),
  client.rpc('mission_fundraising_totals',{p_mission:missionId})
 ]);
 const totals=await Promise.all((campaigns??[]).map(async c=>{const {data}=await client.rpc('fundraising_totals',{p_campaign:c.id});return [c.id,campaignTotal((data??[]) as Total[])] as const;}));
 const raised=new Map(totals);
 const goal=Number(mission?.funding_goal_amount??0),all=Number(totalRows?.[0]?.amount_raised??0),donors=Number(totalRows?.[0]?.donor_count??0);
 const percent=goal>0?Math.round(all/goal*100):0;
 return <Card title="Mission fundraising"><div className="space-y-5">
  <section className="rounded-xl border border-[#26E7D4] p-4" aria-label="Combined mission fundraising progress">
   <h3 className="text-base font-semibold text-ink">Combined Mission Funding</h3>
   <p className="mt-2 text-2xl font-semibold text-gold">{money(all,mission?.currency_code??'EUR')} <span className="text-base text-muted">of {money(goal,mission?.currency_code??'EUR')}</span></p>
   <p className="my-2 text-[#26E7D4]">{percent}% funded · {donors} donor{donors===1?'':'s'}</p>
   <div role="progressbar" aria-label="Combined mission funding" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0,Math.min(100,percent))} className="h-3 overflow-hidden rounded-full bg-panel-raised"><div className="h-full rounded-full bg-[#26E7D4]" style={{width:`${Math.min(100,Math.max(0,percent))}%`}}/></div>
   {goal>0&&all>goal&&<p className="mt-2 font-semibold text-[#26E7D4]">{money(all-goal,mission?.currency_code??'EUR')} raised beyond the funding goal!</p>}
  </section>
  {(campaigns??[]).map(c=>{const total=raised.get(c.id)??{amount:0,count:0};return <div key={c.id} className="rounded-xl border border-line p-4"><Link href={`/fundraising/campaigns/${c.id}`} className="mb-3 block text-gold">{c.title} →</Link><Progress amount={total.amount} count={total.count} goal={Number(mission?.funding_goal_amount??c.goal_amount)} currency={c.currency_code} barColor="turquoise"/><Link href={`/c/${c.id}#donate`} className="mt-3 inline-block text-sm text-gold">Donate or sponsor →</Link></div>})}
  {!campaigns?.length&&<p>No campaigns for this mission yet.</p>}
  <Link href={`/fundraising/campaigns/new?mission=${missionId}`} className="inline-block rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Start fundraising</Link>
 </div></Card>;
}
