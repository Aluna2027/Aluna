import Link from 'next/link';
import { cities } from '@/lib/cities';
import { ownedActors } from '@/lib/social';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { MissionFields } from '@/components/mission-fields';
import { createMission } from '../actions';
export default async function NewMission({searchParams}:{searchParams:Promise<{city?:string;community?:string;error?:string}>}) {
 const {city,community,error}=await searchParams;const client=await createClient();const actors=await ownedActors();
 const {data:communities}=await client.from('mesh_communities').select('id,name,city_id,places(name,source_key)').order('name').limit(200);
 const sortedCities=[...cities].sort((a,b)=>a.name.localeCompare(b.name));
 return <div className="space-y-5"><Link href="/missions" className="text-sm text-gold">← Missions</Link><Card title="Create mission"><form action={createMission} className="max-w-2xl space-y-5">{error&&<p role="alert" className="text-amber-300">Could not create the mission. Check dates, amounts and whether the community belongs to the selected city.</p>}
 <label className="block text-sm">City<select name="city" defaultValue={city??''} required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="" disabled>Select a city</option>{sortedCities.map(c=><option key={c.id} value={c.id}>{c.name}, {c.country}</option>)}</select></label>
 <label className="block text-sm">Wi-Fi Mesh Community (optional)<select name="community_id" defaultValue={community??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">No linked community</option>{communities?.map(c=>{const place=c.places as unknown as {name:string}|null;return <option key={c.id} value={c.id}>{c.name} · {place?.name}</option>})}</select></label>
 <MissionFields/>
 <label className="block text-sm">Create as<select name="actor_id" required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">{actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select></label>
 <button disabled={!actors.length} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Create mission</button></form></Card></div>;
}
