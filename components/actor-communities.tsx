import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
export async function ActorCommunities({actorId}:{actorId:string}) {
 const client=await createClient();const {data:memberships}=await client.from('mesh_community_members').select('community_id,member_role').eq('actor_id',actorId).limit(100);
 const ids=(memberships??[]).map(m=>m.community_id);
 const {data:communities}=ids.length?await client.from('mesh_communities').select('id,name,location_text,places(name)').in('id',ids):{data:[]};
 return <Card title="Wi-Fi Mesh Communities"><div className="space-y-3">{communities?.map(c=><Link key={c.id} href={`/communities/${c.id}`} className="block rounded-xl border border-line p-3 text-gold hover:border-gold">{c.name} <span className="text-sm text-muted">· {(c.places as unknown as {name:string}|null)?.name} · {c.location_text}</span></Link>)}{!communities?.length&&<p>No physical mesh community memberships yet.</p>}<Link href="/communities" className="inline-block text-sm text-gold">Explore communities →</Link></div></Card>;
}
