import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
export async function ActorMissions({actorId}:{actorId:string}) {
 const client=await createClient();const [{data:created},{data:joined}]=await Promise.all([
 client.from('missions').select('id').eq('created_by_actor_id',actorId).order('created_at',{ascending:false}).limit(100),
 client.from('mission_participations').select('mission_id').eq('actor_id',actorId).order('joined_at',{ascending:false}).limit(100),
 ]);
 const ids=[...new Set([...(created??[]).map(m=>m.id),...(joined??[]).map(p=>p.mission_id)])];
 const {data:missions}=ids.length?await client.from('missions').select('id,title,location_text,places(name)').in('id',ids):{data:[]};
 return <Card title="Missions"><div className="space-y-3">{missions?.map(m=><Link key={m.id} href={`/missions/${m.id}`} className="block rounded-xl border border-line p-3 text-gold hover:border-gold">{m.title} <span className="text-sm text-muted">· {(m.places as unknown as {name:string}|null)?.name} · {m.location_text}</span></Link>)}{!missions?.length&&<p>No mission participation yet.</p>}<Link href="/missions" className="inline-block text-sm text-gold">Explore missions →</Link></div></Card>;
}
