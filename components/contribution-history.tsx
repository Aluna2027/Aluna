import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { actorDetails } from '@/lib/social';

const categories = [
 { key: 'time', label: 'Time', description: 'Volunteer hours' },
 { key: 'skills', label: 'Skills', description: 'Contributed expertise' },
 { key: 'equipment', label: 'Equipment', description: 'Installed or supplied equipment' },
 { key: 'services', label: 'Services', description: 'Professional and community services' },
 { key: 'materials', label: 'Materials', description: 'Supplied materials' },
 { key: 'research', label: 'Research', description: 'Research and community studies' },
] as const;
type ContributionRow = {
 id: string; actor_id: string; contribution_type: string; title: string;
 contributed_on: string; created_at: string; details: Record<string, string> | null;
 mission_id: string | null; community_id: string | null;
 missions: { title: string } | null; mesh_communities: { name: string } | null;
};
type VerifiedResult = {
 contribution_id: string; metric_key: string; verified_quantity: number | null;
 unit: string; verification_level: number; proof_id: string | null;
};
function amount(value: number, currency: string) {
 return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}
export async function ContributionHistory({actorId,missionId,communityId,actorView=false}:{
 actorId?: string; missionId?: string; communityId?: string; actorView?: boolean;
}) {
 const client = await createClient();
 let linkedMissionIds: string[] = [];
 if (communityId) {
  const {data} = await client.from('missions').select('id').eq('community_id', communityId).is('removed_at', null).limit(500);
  linkedMissionIds = (data ?? []).map(row => row.id);
 }
 let query = client.from('contributions')
  .select('id,actor_id,contribution_type,title,contributed_on,created_at,details,mission_id,community_id,missions(title),mesh_communities(name)')
  .in('contribution_type', categories.map(group => group.key))
  .order('created_at', { ascending: false }).limit(500);
 if (actorId) query = query.eq('actor_id', actorId);
 if (missionId) query = query.eq('mission_id', missionId);
 if (communityId) {
  query = linkedMissionIds.length
   ? query.or(`community_id.eq.${communityId},mission_id.in.(${linkedMissionIds.join(',')})`)
   : query.eq('community_id', communityId);
 }
 const {data, error} = await query;
 const rows = (data ?? []) as unknown as ContributionRow[];
 const {data:rawResults} = rows.length
  ? await client.from('pr43_contribution_results')
    .select('contribution_id,metric_key,verified_quantity,unit,verification_level,proof_id')
    .in('contribution_id', rows.map(row => row.id)).gte('verification_level', 3).not('verified_quantity', 'is', null)
    .limit(2000)
  : { data: [] };
 const results = (rawResults ?? []) as VerifiedResult[];
 const proofIds = [...new Set(results.map(result => result.proof_id).filter((id): id is string => Boolean(id)))];
 const {data:reviewEvents} = proofIds.length
  ? await client.from('proof_verification_events')
    .select('proof_id,method,recorded_at,id')
    .in('proof_id',proofIds)
    .order('recorded_at',{ascending:false})
    .order('id',{ascending:false})
    .limit(2000)
  : {data:[]};
 const latestReviewMethod = new Map<string,string>();
 for (const event of reviewEvents ?? []) {
  if (!latestReviewMethod.has(event.proof_id)) latestReviewMethod.set(event.proof_id,event.method);
 }
 const isAlunaInternal=(result:VerifiedResult) => result.verification_level===4
  && result.proof_id!==null
  && ['aluna_super_admin_override','aluna_accredited_l4_review'].includes(latestReviewMethod.get(result.proof_id)??'');
 const verified = new Map<string, VerifiedResult[]>();
 for (const item of results) {
  const existing = verified.get(item.contribution_id) ?? [];
  existing.push(item);
  verified.set(item.contribution_id, existing);
 }
 // A record appears when a linked result has L3/L4 approval with a confirmed value; internal L4 approvals remain distinct from independent review.
 const entries = rows.filter(row => verified.has(row.id));
 const actors = await actorDetails(actorView ? [] : entries.map(row => row.actor_id));
 const financial = new Map<string, number>();
 const gifts = new Map<string, number>();
 for (const row of entries) {
  if (!['equipment','services','materials','research'].includes(row.contribution_type)) continue;
  // A verified contribution result reflects review of the disclosed classification,
  // monetary amount and supporting evidence. Never infer amounts from legacy records.
  const nature = row.details?.nature;
  const currency = row.details?.currency;
  const rawAmount = row.details?.amount;
  if (!['EUR','USD'].includes(currency ?? '') || rawAmount == null || rawAmount === '') continue;
  const value = Number(rawAmount);
  if (!Number.isFinite(value) || value < 0 || value > 1e9) continue;
  const target = nature === 'purchased' ? financial
   : nature === 'donated_in_kind' ? gifts : null;
  if (!target) continue;
  target.set(currency!, (target.get(currency!) ?? 0) + value);
 }
 const totals = (values: Map<string, number>) => [...values].map(([currency,value]) => amount(value, currency)).join(' + ') || 'No verified monetary value';
 return <section id="contribution-history" className="space-y-4" aria-label="Contribution History">
  <div className="flex flex-wrap items-end justify-between gap-2">
   <div><h2 className="text-xl font-bold text-ink">Contribution History</h2>
    <p className="mt-1 text-sm text-muted">Verified contributions (L3/L4), including labelled internal Aluna L4 approvals. Internal approval is not independent verification. Select a category to inspect records and contributors.</p></div>
   <span className="text-sm text-muted">{entries.length} verified records (latest 500 checked)</span>
  </div>
  {error && <p role="alert" className="text-red-300">Unable to load contribution history.</p>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {categories.filter(group => !actorView || entries.some(row => row.contribution_type === group.key)).map(group => {
    const items = entries.filter(row => row.contribution_type === group.key);
    return <details key={group.key} className="group rounded-xl border border-line bg-panel p-4 open:sm:col-span-2 open:xl:col-span-3">
     <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
      <div><h3 className="font-semibold text-ink">{group.label}</h3>
       <p className="mt-1 text-xs text-muted">{group.description} · {items.length} verified</p></div>
      <span className="text-gold group-open:rotate-90" aria-hidden="true">›</span>
     </summary>
     <div className="mt-4 space-y-3 border-t border-line pt-4">
      {items.map(row => {
       const metrics = verified.get(row.id) ?? [];
       const nature = row.details?.nature;
       const monetary = ['purchased','donated_in_kind'].includes(nature ?? '') && ['EUR','USD'].includes(row.details?.currency ?? '') && row.details?.amount !== undefined
        && Number.isFinite(Number(row.details.amount)) && Number(row.details.amount) >= 0;
       return <article key={row.id} className="rounded-xl border border-line bg-panel-raised p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
         <div><Link href={`/contributions/${row.id}`} className="font-semibold text-gold hover:underline">{row.title} →</Link>
          <p className="mt-1 text-xs text-muted">{row.contributed_on} · {row.missions?.title ?? row.mesh_communities?.name ?? 'Linked project'}</p>
          {!actorView && <p className="mt-1 text-xs">Contributor: {actors.get(row.actor_id)?.name ?? 'Member'}</p>}
         </div>
         <span className="text-xs text-[#26E7D4]">{metrics.some(isAlunaInternal) ? 'L4 Aluna Internal Approval (not independent)' : `L${Math.max(...metrics.map(m => m.verification_level))} verified`}</span>
        </div>
        {monetary && <p className="mt-2 text-sm">{nature === 'donated_in_kind' ? 'In-kind value' : 'Money Spent'}: {amount(Number(row.details!.amount), row.details!.currency)}
         {nature === 'purchased' && row.details?.funding_source ? ` · ${row.details.funding_source.replaceAll('_',' ')}` : ''}</p>}
        {group.key === 'time' && <p className="mt-2 text-sm">Verified hours: {metrics.find(m => m.metric_key === 'volunteer_hours')?.verified_quantity ?? '—'}</p>}
       </article>;
      })}
      {!items.length && <p className="text-sm text-muted">No verified contributions in this category.</p>}
     </div>
    </details>;
   })}
   {actorView && !entries.length && <p className="text-sm text-muted">No verified contributions for this selection yet.</p>}
  </div>
  <div className="rounded-xl border border-line bg-panel p-4 text-sm">
   <p className="font-semibold text-ink">Verified financial contributions in displayed records</p>
   <p className="mt-2">Money Spent in displayed records (Equipment + Services + Materials + Research): <span className="text-gold">{totals(financial)}</span></p>
   <p className="mt-1">In-kind Value in displayed records (separate from spending): <span className="text-gold">{totals(gifts)}</span></p>
   <p className="mt-2 text-xs text-muted">EUR and USD are not added together without a documented exchange rate. These are record-level figures from the current history window, not an authoritative all-time project financial balance.</p>
  </div>
 </section>;
}
