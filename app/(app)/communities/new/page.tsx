import Link from 'next/link';
import { cities } from '@/lib/cities';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { createCommunity } from '../actions';
export default async function NewCommunity({searchParams}:{searchParams:Promise<{city?:string;error?:string}>}) {
 const {city,error}=await searchParams;const actors=await ownedActors();const cityList=[...cities].sort((a,b)=>a.name.localeCompare(b.name));
 return <div className="space-y-5"><Link href="/communities" className="text-sm text-gold">← Communities</Link><Card title="Add a physical Wi-Fi Mesh Community"><p className="mb-5 text-sm">Choose the city and describe the physical area. Infrastructure counts can be added later.</p><form action={createCommunity} className="max-w-2xl space-y-5">{error&&<p role="alert" className="text-amber-300">Could not create the community. Check the details and try again.</p>}
 <label className="block text-sm">City<select name="city" defaultValue={city??''} required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="" disabled>Select a city</option>{cityList.map(c=><option key={c.id} value={c.id}>{c.name}, {c.country}</option>)}</select></label>
 <label className="block text-sm">Community name<input name="name" required minLength={2} maxLength={160} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">Physical location<input name="location" required minLength={2} maxLength={240} placeholder="Neighborhood, settlement or area" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">About<textarea name="description" maxLength={3000} rows={4} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">Create as<select name="actor_id" required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">{actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select></label>
 <button disabled={!actors.length} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Create community</button>
 </form></Card></div>;
}
