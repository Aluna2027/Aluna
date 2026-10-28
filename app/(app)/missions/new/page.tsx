import Link from 'next/link';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { MissionFields } from '@/components/mission-fields';
import { MissionCommunityLocation } from '@/components/mission-community-location';
import { createMission } from '../actions';
export default async function NewMission({searchParams}:{searchParams:Promise<{city?:string;community?:string;error?:string;organization?:string}>}) {
 const {city,community,error,organization}=await searchParams;const allActors=await ownedActors();const actors=organization?allActors.filter(a=>a.href===`/organizations/${organization}`):allActors;
 
 
 return <div className="space-y-5"><Link href="/missions" className="text-sm text-gold">← SDG Missions</Link><Card title="Create SDG Mission"><form action={createMission} className="max-w-2xl space-y-5">{organization&&<input type="hidden" name="organization_id" value={organization}/>}{error&&<p role="alert" className="text-amber-300">Could not create the SDG Mission. Check dates, amounts and whether the community belongs to the selected city.</p>}
 <MissionCommunityLocation defaultCity={city??''} defaultCommunity={community??''}/>
 <MissionFields/>
 <label className="block text-sm">Create as<select name="actor_id" required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">{actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select></label>
 <button disabled={!actors.length} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Create SDG Mission</button></form></Card></div>;
}
