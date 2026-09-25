import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cities } from '@/lib/cities';
import { metric } from '@/lib/communities';
export default async function Communities({searchParams}:{searchParams:Promise<{city?:string;page?:string}>}) {
 const {city:citySource,page}=await searchParams;const client=await createClient();const selectedCity=cities.find(c=>c.id===citySource);
 const {data:place}=selectedCity?await client.from('places').select('id').eq('source_key',selectedCity.id).maybeSingle():{data:null};
 const pageNumber=Math.max(0,Math.min(1000,Number.parseInt(page??'0',10)||0));
 let query=client.from('mesh_communities').select('id,city_id,name,location_text,description,population,people_connected,nodes,local_owners,is_verified,created_at,places(name,country_code,source_key)').order('created_at',{ascending:false}).range(pageNumber*20,pageNumber*20+19);
 if(selectedCity){if(!place)return <p className="text-muted">This city is not available in the database yet.</p>;query=query.eq('city_id',place.id);}
 const {data:communities}=await query;
 return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="deck-label">PHYSICAL PLACES · COMMUNITY-OWNED CONNECTIVITY</p><h1 className="mt-2 text-4xl">Wi-Fi Mesh Communities</h1><p className="mt-3 text-sm text-muted">{selectedCity?`Communities in ${selectedCity.name}`:'Explore physical Wi-Fi mesh communities and their members.'}</p></div><Link href={selectedCity?`/communities/new?city=${selectedCity.id}`:'/communities/new'} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Add a community</Link></div>
 {selectedCity&&<Link href="/communities" className="text-sm text-gold">Show all communities →</Link>}
 <div className="grid gap-4 md:grid-cols-2">{communities?.map(item=>{const place=item.places as unknown as {name:string;country_code:string;source_key:string}|null;return <Link key={item.id} href={`/communities/${item.id}`} className="glass rounded-2xl p-6 hover:border-gold"><p className="deck-label">{place?.name||'City'} · {place?.country_code}</p><h2 className="mt-2 text-xl">{item.name}</h2><p className="mt-2 text-sm text-muted">{item.location_text}</p><p className="mt-4 text-sm text-muted">People connected: {metric(item.people_connected)} · Nodes: {metric(item.nodes)}</p><p className="mt-2 text-xs text-muted">{item.is_verified?'Verified':'Community details not verified by Aluna'}</p></Link>})}</div>
 {!communities?.length&&<p className="glass rounded-2xl p-6 text-muted">No communities have been added here yet.</p>}
 {communities?.length===20&&<Link href={`/communities?${selectedCity?`city=${selectedCity.id}&`:''}page=${pageNumber+1}`} className="text-gold">More communities →</Link>}
 </div>;
}
