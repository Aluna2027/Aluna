import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { MissionFields } from '@/components/mission-fields';
import type { Mission } from '@/lib/missions';
import { updateMission } from '../../actions';
export default async function EditMission({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();const {data:mission}=await client.from('missions').select('*').eq('id',id).maybeSingle();if(!mission)notFound();
 const actors=await ownedActors();if(!actors.some(a=>a.id===mission.created_by_actor_id))notFound();
 return <div className="space-y-5"><Link href={`/missions/${id}`} className="text-sm text-gold">← Mission</Link><Card title="Edit mission"><form action={updateMission} className="max-w-2xl space-y-5"><input type="hidden" name="id" value={id}/>{error&&<p role="alert" className="text-amber-300">Could not save the mission. Check dates and amounts.</p>}<MissionFields mission={mission as Mission}/><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Save mission</button></form></Card></div>;
}
