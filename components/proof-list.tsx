import Link from 'next/link';
import { Card } from '@/components/ui';
import { verificationLevels } from '@/lib/proofs';
import { createClient } from '@/lib/supabase/server';
import { actorDetails } from '@/lib/social';
export async function ProofList({actorId,missionId,communityId,contributionId,postId,iconColor,titleIcon=false,allowCreate=false}:{allowCreate?:boolean;actorId?:string;missionId?:string;communityId?:string;contributionId?:string;postId?:string;iconColor?:string;titleIcon?:boolean}){
 const client=await createClient();let query=client.from('proofs').select('id,actor_id,mission_id,contribution_id,verification_level,evidence_type,result_text,occurred_on').order('created_at',{ascending:false}).limit(30);
 if(actorId)query=query.eq('actor_id',actorId);if(missionId)query=query.eq('mission_id',missionId);if(contributionId)query=query.eq('contribution_id',contributionId);if(postId)query=query.eq('post_id',postId);
 if(communityId){const [{data:missions},{data:contributions}]=await Promise.all([client.from('missions').select('id').eq('community_id',communityId).limit(200),client.from('contributions').select('id').eq('community_id',communityId).limit(200)]);const missionIds=(missions??[]).map(m=>m.id);const contributionIds=(contributions??[]).map(c=>c.id);if(!missionIds.length&&!contributionIds.length)return <Card title="Proofs" iconColor={iconColor}><p>No proofs recorded here yet.</p></Card>;const filters=[missionIds.length&&`mission_id.in.(${missionIds.join(',')})`,contributionIds.length&&`contribution_id.in.(${contributionIds.join(',')})`].filter(Boolean).join(',');query=query.or(filters);}
 const {data,error}=await query;const actors=await actorDetails((data??[]).map(p=>p.actor_id));
 const level4Ids=(data??[]).filter(p=>p.verification_level===4).map(p=>p.id);
 const {data:level4Events}=level4Ids.length
  ?await client.from('proof_verification_events')
    .select('proof_id,method,recorded_at')
    .in('proof_id',level4Ids).eq('new_level',4)
    .order('recorded_at',{ascending:false}).limit(200)
  :{data:[]};
 const latestL4=new Map<string,string>();
 for(const event of level4Events??[]){
  if(!latestL4.has(event.proof_id))latestL4.set(event.proof_id,event.method);
 }
 return <Card title="Proofs" iconColor={iconColor}><p className="mb-5 text-sm">Each level records who reviewed the evidence. L1 has no independent verification.</p>{allowCreate&&<Link href="/proofs/new" className="mb-5 inline-block rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-navy">Submit proof</Link>}{error?<p>Could not load proofs.</p>:<div className="space-y-3">{data?.map(p=><Link key={p.id} href={`/proofs/${p.id}`} className="block rounded-xl border border-line p-4 hover:border-gold"><span className="deck-label">{p.verification_level===4&&['aluna_super_admin_override','aluna_accredited_l4_review'].includes(latestL4.get(p.id)??'')?'L4 Aluna Internal Approval (not independent)':verificationLevels[p.verification_level]} · {p.occurred_on}</span><span className="mt-2 block line-clamp-2 text-ink">{p.result_text}</span><span className="mt-2 block text-xs">{actors.get(p.actor_id)?.name??'Member'} · {p.evidence_type.replaceAll('_',' ')}</span></Link>)}{!data?.length&&<p>No proofs recorded yet.</p>}</div>}</Card>;
}
