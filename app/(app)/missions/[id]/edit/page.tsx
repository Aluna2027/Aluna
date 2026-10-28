import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { MissionFields } from '@/components/mission-fields';
import { MissionCommunityLocation } from '@/components/mission-community-location';
import type { Mission } from '@/lib/missions';
import { updateMission } from '../../actions';
export default async function EditMission({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();const {data:mission}=await client.from('missions').select('*,places(source_key)').eq('id',id).is('removed_at',null).maybeSingle();if(!mission)notFound();
 const actors=await ownedActors();if(!actors.some(a=>a.id===mission.created_by_actor_id))notFound();
 const {data:sdgRows}=await client.from('mission_sdgs').select('sdg_number').eq('mission_id',id).order('sdg_number');const selectedSdgs=(sdgRows??[]).map(row=>Number(row.sdg_number));
 return <div className="space-y-5"><Link href={`/missions/${id}`} className="text-sm text-gold">← SDG Mission</Link><Card title="Edit SDG Mission"><form action={updateMission} className="max-w-2xl space-y-5"><input type="hidden" name="id" value={id}/>{error&&<p role="alert" className="text-amber-300">Could not save the mission. Check dates and amounts.</p>}<MissionCommunityLocation defaultCity={(mission.places as unknown as {source_key:string}|null)?.source_key??''} defaultCommunity={mission.community_id??''} defaultManual={mission.manual_place??''} defaultCountry={mission.manual_country??''}/><MissionFields mission={mission as Mission} selectedSdgs={selectedSdgs}/><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Save SDG Mission</button></form></Card></div>;
}
