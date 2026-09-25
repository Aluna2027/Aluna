import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { cities } from '@/lib/cities';
import { evidenceTypes } from '@/lib/proofs';
import { Card } from '@/components/ui';
import { createProof } from '../actions';
export default async function NewProof({searchParams}:{searchParams:Promise<{mission?:string;contribution?:string;post?:string;error?:string}>}){
 const {mission,contribution,post,error}=await searchParams;const client=await createClient();const actors=await ownedActors();const ids=actors.map(a=>a.id);
 const [{data:contributions},{data:posts},{data:missions}]=await Promise.all([
  ids.length?client.from('contributions').select('id,title,actor_id').in('actor_id',ids).order('created_at',{ascending:false}).limit(200):Promise.resolve({data:[]}),
  ids.length?client.from('posts').select('id,body,actor_id').in('actor_id',ids).eq('visibility','public').order('created_at',{ascending:false}).limit(200):Promise.resolve({data:[]}),
  client.from('missions').select('id,title').order('created_at',{ascending:false}).limit(200),
 ]);
 const input='mt-2 w-full rounded-xl border border-line bg-panel-raised p-3';
 return <div className="space-y-5"><Link href="/proofs" className="text-sm text-gold">← Proofs</Link><Card title="Submit proof"><form action={createProof} className="max-w-2xl space-y-5">{error&&<p role="alert" className="text-amber-300">Could not submit proof. Check the evidence and that all linked records belong to the selected actor and location.</p>}<p className="text-sm">Submissions begin at L1 Self-Reported. Providing a sensor link or partner name does not verify it automatically. Select a contribution or public post by the same actor.</p>
 <label className="block text-sm">Actor<select name="actor_id" required className={input}>{actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select></label>
 <label className="block text-sm">Contribution<select name="contribution_id" defaultValue={contribution??''} className={input}><option value="">No contribution</option>{contributions?.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
 <label className="block text-sm">Public post<select name="post_id" defaultValue={post??''} className={input}><option value="">No post</option>{posts?.map(p=><option key={p.id} value={p.id}>{p.body.slice(0,110)}</option>)}</select></label>
 <label className="block text-sm">Mission (optional)<select name="mission_id" defaultValue={mission??''} className={input}><option value="">From contribution or post</option>{missions?.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
 <label className="block text-sm">City (optional)<select name="city" className={input}><option value="">From mission or contribution</option>{[...cities].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}, {c.country}</option>)}</select></label>
 <label className="block text-sm">Evidence type<select name="evidence_type" className={input}>{evidenceTypes.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></label>
 <label className="block text-sm">Evidence link (HTTPS, optional)<input type="url" name="evidence_url" placeholder="https://" maxLength={2000} className={input}/></label>
 <label className="block text-sm">Evidence description<textarea name="evidence_description" required minLength={10} maxLength={3000} rows={4} className={input}/></label>
 <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Latitude<input name="latitude" type="number" step="any" min="-90" max="90" className={input}/></label><label className="block text-sm">Longitude<input name="longitude" type="number" step="any" min="-180" max="180" className={input}/></label></div><p className="text-xs">Both coordinates are required for geolocation evidence. Coordinates are supplied by the submitter and are not verified by GPS.</p>
 <label className="block text-sm">Impact result<textarea name="result_text" required minLength={10} maxLength={3000} rows={4} className={input}/></label>
 <label className="block text-sm">Date of activity<input name="occurred_on" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className={input}/></label>
 <button disabled={!actors.length} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Submit at L1</button></form></Card></div>;
}
