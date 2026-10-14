import Link from 'next/link';
import { Search, Wifi } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { cities } from '@/lib/cities';
import { metric } from '@/lib/communities';
import { ownedActors } from '@/lib/social';
import { joinCommunityFromDirectory } from './actions';

type View='all'|'joined'|'managed';
function directoryUrl(view:View='all',city?:string,q?:string,page=0,openSearch=false){const p=new URLSearchParams();if(view!=='all')p.set('view',view);if(city)p.set('city',city);if(q)p.set('q',q);if(page>0)p.set('page',String(page));if(openSearch)p.set('search','1');const v=p.toString();return v?`/communities?${v}`:'/communities';}
export default async function Communities({searchParams}:{searchParams:Promise<{city?:string;page?:string;q?:string;view?:string;search?:string;status?:string;error?:string}>}) {
 const {city:citySource,page,q:rawQuery,view:rawView,search:searchOpen,status,error:actionError}=await searchParams;const client=await createClient();const selectedCity=cities.find(c=>c.id===citySource);const queryText=(rawQuery??'').trim().slice(0,120);
 const view:View=rawView==='joined'||rawView==='managed'?rawView:'all';
 const actors=await ownedActors();
 const actorIds=actors.map(actor=>actor.id);
 const {data:memberships,error:membershipError}=actorIds.length?await client.from('mesh_community_members').select('community_id,actor_id,member_role').in('actor_id',actorIds).limit(1000):{data:[],error:null};
 const ownMemberships=memberships??[];
 const memberCommunityIds=[...new Set(ownMemberships.filter(m=>view==='joined'||m.member_role==='steward').map(m=>m.community_id))];
 const {data:place}=selectedCity?await client.from('places').select('id').eq('source_key',selectedCity.id).maybeSingle():{data:null};
 const pageNumber=Math.max(0,Math.min(1000,Number.parseInt(page??'0',10)||0));
 let matchingPlaceIds:string[]=[];
 if(queryText){const needle=queryText.toLocaleLowerCase('en');const matchingSourceKeys=cities.filter(c=>c.name.toLocaleLowerCase('en').includes(needle)||c.country.toLocaleLowerCase('en').includes(needle)||c.countryCode.toLocaleLowerCase('en').includes(needle)).map(c=>c.id);if(matchingSourceKeys.length){const {data:matchingPlaces}=await client.from('places').select('id').in('source_key',matchingSourceKeys.slice(0,500));matchingPlaceIds=(matchingPlaces??[]).map(item=>item.id);}}
 let query=client.from('mesh_communities').select('id,city_id,name,location_text,description,population,people_connected,nodes,local_owners,is_verified,created_at,places(name,country_code,source_key)').is('removed_at',null).order('created_at',{ascending:false}).range(pageNumber*20,pageNumber*20+19);
 if(selectedCity){if(!place)return <p className="text-muted">This city is not available in the database yet.</p>;query=query.eq('city_id',place.id);}
 if(view!=='all')query=memberCommunityIds.length?query.in('id',memberCommunityIds):query.eq('id','00000000-0000-0000-0000-000000000000');
 if(queryText){const safe=queryText.replace(/[%_,()]/g,' ').replace(/\s+/g,' ').trim();const filters=[safe?`name.ilike.%${safe}%`:null,safe?`location_text.ilike.%${safe}%`:null,matchingPlaceIds.length?`city_id.in.(${matchingPlaceIds.join(',')})`:null].filter(Boolean).join(',');if(filters)query=query.or(filters);else query=query.eq('id','00000000-0000-0000-0000-000000000000');}
 const {data:communities,error:communitiesError}=await query;
 const membershipsByCommunity=new Map<string,Set<string>>();
 for(const m of ownMemberships){const set=membershipsByCommunity.get(m.community_id)??new Set<string>();set.add(m.actor_id);membershipsByCommunity.set(m.community_id,set);}
 const managedIds=new Set(ownMemberships.filter(m=>m.member_role==='steward').map(m=>m.community_id));
 return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="deck-label">PHYSICAL PLACES · COMMUNITY-OWNED CONNECTIVITY</p><h1 className="mt-2 text-4xl">Wi-Fi Mesh Communities</h1><p className="mt-3 text-sm text-muted">{selectedCity?`Communities in ${selectedCity.name}`:'Explore physical Wi-Fi mesh communities and their members.'}</p></div><Link href={selectedCity?`/communities/new?city=${selectedCity.id}`:'/communities/new'} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Add a community</Link></div>
 <form method="get" className="glass rounded-2xl p-4">{selectedCity&&<input type="hidden" name="city" value={selectedCity.id}/>}<label className="block text-sm">Search Mesh Communities<div className="mt-2 flex flex-col gap-2 sm:flex-row"><input name="q" defaultValue={queryText} placeholder="Search by community name, city or country" className="w-full rounded-xl border border-line bg-panel-raised p-3"/><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Search</button>{queryText&&<Link href={selectedCity?`/communities?city=${selectedCity.id}`:'/communities'} className="rounded-xl border border-line px-5 py-3 text-center text-gold">Clear</Link>}</div></label></form>
 {(selectedCity||queryText)&&<Link href="/communities" className="text-sm text-gold">Show all communities →</Link>}
 <div className="grid gap-4 md:grid-cols-2">{communities?.map(item=>{const place=item.places as unknown as {name:string;country_code:string;source_key:string}|null;const cityInfo=place?.source_key?cities.find(c=>c.id===place.source_key):null;return <Link key={item.id} href={`/communities/${item.id}`} className="glass rounded-2xl p-6 hover:border-gold"><p className="text-sm font-semibold text-gold">{cityInfo?.name||place?.name||'City'} · {cityInfo?.country||place?.country_code}</p><p className="mt-2 text-sm text-ink">SDG 9: Industry, Innovation and Infrastructure</p><h2 className="mt-2 text-xl text-gold">{item.name}</h2><p className="mt-2 text-sm text-ink">{item.location_text}</p><p className="mt-4 text-sm text-gold">People connected: {metric(item.people_connected)} · Nodes: {metric(item.nodes)}</p><p className="mt-2 text-xs text-ink">{item.is_verified?'Verified':'Community details not verified by Aluna'}</p></Link>})}</div>
 {!communities?.length&&<p className="glass rounded-2xl p-6 text-muted">{queryText?'No communities match your search.':'No communities have been added here yet.'}</p>}
 {communities?.length===20&&<Link href={`/communities?${selectedCity?`city=${selectedCity.id}&`:''}${queryText?`q=${encodeURIComponent(queryText)}&`:''}page=${pageNumber+1}`} className="text-gold">More communities →</Link>}
 </div>;
}
