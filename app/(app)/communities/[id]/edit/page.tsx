import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { updateCommunity } from '../../actions';
export default async function EditCommunity({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();const actors=await ownedActors();
 const {data:community}=await client.from('mesh_communities').select('id,name,location_text,description,population,people_connected,nodes,local_owners').eq('id',id).is('removed_at',null).maybeSingle();if(!community)notFound();
 const {data:stewards}=await client.from('mesh_community_members').select('actor_id').eq('community_id',id).eq('member_role','steward');if(!stewards?.some(s=>actors.some(a=>a.id===s.actor_id)))notFound();
 return <div className="space-y-5"><Link href={`/communities/${id}`} className="text-sm text-gold">← Community</Link><Card title="Edit Wi-Fi Mesh Community"><p className="mb-5 text-sm">Report actual values only. Empty figures appear as “Not reported”.</p><form action={updateCommunity} className="max-w-2xl space-y-5"><input type="hidden" name="id" value={id}/>{error&&<p role="alert" className="text-amber-300">Check the details and try again. People connected cannot exceed population.</p>}
 <label className="block text-sm">Name<input name="name" required minLength={2} maxLength={160} defaultValue={community.name} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">Physical location<input name="location" required minLength={2} maxLength={240} defaultValue={community.location_text} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">About<textarea name="description" maxLength={3000} rows={4} defaultValue={community.description??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <div className="grid gap-4 sm:grid-cols-2">{([['population','Population'],['people_connected','People connected'],['nodes','Nodes'],['local_owners','Local owners']] as const).map(([key,label])=><label key={key} className="block text-sm">{label}<input name={key} type="number" min={0} max={2147483647} defaultValue={community[key]??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>)}</div>
 <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Save community</button></form></Card></div>;
}
