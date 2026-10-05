import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cities } from '@/lib/cities';
import { money } from '@/lib/missions';
export default async function Missions({searchParams}:{searchParams:Promise<{city?:string;community?:string;page?:string}>}) {
 const {city,community,page}=await searchParams;const client=await createClient();const selectedCity=cities.find(c=>c.id===city);
 const {data:place}=selectedCity?await client.from('places').select('id').eq('source_key',selectedCity.id).maybeSingle():{data:null};
 const pageNumber=Math.max(0,Math.min(1000,Number.parseInt(page??'0',10)||0));
 let query=client.from('missions').select('id,title,goal,location_text,funding_goal_amount,currency_code,city_id,manual_place,manual_country,community_id,places(name,source_key)').order('created_at',{ascending:false}).range(pageNumber*20,pageNumber*20+19);
 if(selectedCity){if(!place)return <p className="text-muted">This city is not available in the database yet.</p>;query=query.eq('city_id',place.id);}
 if(community&&/^[0-9a-f-]{36}$/i.test(community))query=query.eq('community_id',community);
 const {data:missions}=await query;
 return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="deck-label">PEOPLE · PLACES · PURPOSE</p><h1 className="mt-2 text-4xl">Missions</h1><p className="mt-2 text-muted">Join real work in real places.</p></div><Link href={selectedCity?`/missions/new?city=${selectedCity.id}`:'/missions/new'} className="h-fit rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Create mission</Link></div>
 {(selectedCity||community)&&<Link href="/missions" className="text-sm text-gold">Show all missions →</Link>}
 <div className="grid gap-4 md:grid-cols-2">{missions?.map(m=>{const place=m.places as unknown as {name:string;source_key:string}|null;const placeLabel=place?.name||(m.manual_place&&m.manual_country?`${m.manual_place}, ${m.manual_country}`:'City');return <Link key={m.id} href={`/missions/${m.id}`} className="glass rounded-2xl p-6 hover:border-gold"><p className="deck-label">{placeLabel} · {m.location_text}</p><h2 className="mt-3 text-xl">{m.title}</h2><p className="mt-3 line-clamp-2 text-sm text-muted">{m.goal}</p><p className="mt-4 text-sm text-gold">Funding goal: {money(m.funding_goal_amount,m.currency_code)}</p></Link>})}</div>{!missions?.length&&<p className="glass rounded-2xl p-6 text-muted">No missions have been added here yet.</p>}
 {missions?.length===20&&<Link href={`/missions?${selectedCity?`city=${selectedCity.id}&`:''}${community?`community=${community}&`:''}page=${pageNumber+1}`} className="text-gold">More missions →</Link>}
 </div>;
}
