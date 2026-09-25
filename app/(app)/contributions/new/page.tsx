import Link from 'next/link';
import { cities } from '@/lib/cities';
import { contributionTypes } from '@/lib/contributions';
import { ownedActors } from '@/lib/social';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { createContribution } from '../actions';
export default async function NewContribution({searchParams}:{searchParams:Promise<{actor?:string;mission?:string;community?:string;city?:string;error?:string}>}) {
 const {actor,mission,community,city,error}=await searchParams;const client=await createClient();const actors=await ownedActors();
 const [{data:missions},{data:communities}]=await Promise.all([client.from('missions').select('id,title').order('created_at',{ascending:false}).limit(200),client.from('mesh_communities').select('id,name').order('name').limit(200)]);
 const fields='mt-2 w-full rounded-xl border border-line bg-panel-raised p-3';
 return <div className="space-y-5"><Link href="/contributions" className="text-sm text-gold">← Contributions</Link><Card title="Record contribution"><form action={createContribution} className="max-w-2xl space-y-5">{error&&<p role="alert" className="text-amber-300">Could not save. Check your fields, permissions and whether the linked places match.</p>}
 <p className="text-sm">Contributions are self-reported. A Money entry does not count toward donations or fundraising totals.</p>
 <label className="block text-sm">Contribute as<select name="actor_id" required defaultValue={actor&&actors.some(a=>a.id===actor)?actor:actors[0]?.id} className={fields}>{actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select></label>
 <label className="block text-sm">Type<select name="contribution_type" required className={fields}>{contributionTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
 <label className="block text-sm">Title<input name="title" required minLength={3} maxLength={160} className={fields}/></label>
 <label className="block text-sm">Description<textarea name="description" required minLength={10} maxLength={3000} rows={5} className={fields}/></label>
 <label className="block text-sm">Date contributed<input type="date" name="contributed_on" required defaultValue={new Date().toISOString().slice(0,10)} className={fields}/></label>
 <label className="block text-sm">Mission (optional)<select name="mission_id" defaultValue={mission??''} className={fields}><option value="">No mission</option>{missions?.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
 <label className="block text-sm">Wi-Fi Mesh Community (optional)<select name="community_id" defaultValue={community??''} className={fields}><option value="">No community</option>{communities?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label className="block text-sm">City (optional when linked to a mission or community)<select name="city" defaultValue={city??''} className={fields}><option value="">No city / use linked location</option>{[...cities].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}, {c.country}</option>)}</select></label>
 <button disabled={!actors.length} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Record contribution</button>{!actors.length&&<p>Create a profile before recording a contribution.</p>}</form></Card></div>;
}
