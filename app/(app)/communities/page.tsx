import Link from 'next/link';
import { Search, Wifi, MapPin, UsersRound, RadioTower, UserRoundPlus, CircleCheck, Ellipsis } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { cities } from '@/lib/cities';
import { metric } from '@/lib/communities';
import { ownedActors } from '@/lib/social';
import { joinCommunityFromDirectory, leaveCommunityFromDirectory, removeCommunity } from './actions';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';

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

 return <div className="space-y-6">
  {status==='left'&&<p role="status" className="rounded-xl border border-[#26E7D4] p-3 text-[#26E7D4]">You left the Wi-Fi Mesh Community.</p>}
  {status==='joined'&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">You joined the Wi-Fi Mesh Community.</p>}
  {actionError&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not join the community. Please try again.</p>}
  {membershipError&&<p role="alert" className="text-red-300">Could not load your memberships.</p>}
  <nav aria-label="Wi-Fi Mesh Communities categories" className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
    {([['All','all'],['Joined','joined'],['Managed','managed']] as const).map(([label,value])=><Link key={value} href={directoryUrl(value,selectedCity?.id,queryText)} aria-current={view===value?'page':undefined} className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm ${view===value?'bg-gold font-semibold text-navy':'glass'}`}>{label}</Link>)}
   </div>
   <div className="flex shrink-0 gap-2">
    <Link href={selectedCity?`/communities/new?city=${selectedCity.id}`:'/communities/new'} className="rounded-full border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">+ Create</Link>
    <Link href={directoryUrl(view,selectedCity?.id,queryText,0,true)+'#communities-search'} aria-label="Search Wi-Fi Mesh Communities" className="rounded-full border border-line bg-panel-raised p-2 text-gold hover:border-gold"><Search size={18}/></Link>
   </div>
  </nav>
  <details id="communities-search" className="glass rounded-2xl p-4" open={Boolean(queryText)||searchOpen==='1'}>
   <summary className="cursor-pointer text-sm font-semibold text-gold">Search Wi-Fi Mesh Communities</summary>
   <form method="get" className="mt-3 flex flex-wrap gap-2">
    {view!=='all'&&<input type="hidden" name="view" value={view}/>}
    {selectedCity&&<input type="hidden" name="city" value={selectedCity.id}/>}
    <label className="sr-only" htmlFor="communities-query">Search by community name, city or country</label>
    <input id="communities-query" name="q" defaultValue={queryText} placeholder="Search by community name, city or country" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/>
    <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Search</button>
    {queryText&&<Link href={directoryUrl(view,selectedCity?.id)} className="rounded-xl border border-line px-4 py-3 text-gold">Clear</Link>}
   </form>
  </details>
  {selectedCity&&<p className="text-sm text-muted">Communities in {selectedCity.name} · <Link href={directoryUrl(view)} className="text-gold">Show all cities</Link></p>}
  {communitiesError&&<p role="alert" className="text-red-300">Communities could not be loaded.</p>}
  <div className="grid gap-4 md:grid-cols-2">
   {communities?.map(item=>{
    const place=item.places as unknown as {name:string;country_code:string;source_key:string}|null;
    const cityInfo=place?.source_key?cities.find(c=>c.id===place.source_key):null;
    const joinedActorIds=membershipsByCommunity.get(item.id)??new Set<string>();
    const availableActors=actors.filter(actor=>!joinedActorIds.has(actor.id));
    const joined=joinedActorIds.size>0;
    const isManager=managedIds.has(item.id);
    const leaveable=ownMemberships.filter(m=>m.community_id===item.id&&m.member_role==='member');
    return <article key={item.id} className="relative flex h-full flex-col rounded-[18px] border border-line bg-panel p-[18px] text-ink">
     {isManager&&<details className="absolute right-4 top-3 z-[2] rounded-xl bg-panel">
      <summary aria-label="Manage community" className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-line text-muted hover:text-ink"><Ellipsis size={22}/></summary>
      <div className="absolute right-0 top-10 z-20 w-36 rounded-xl border border-line bg-panel-raised p-2 shadow-xl">
       <Link href={`/communities/${item.id}/edit`} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-panel">Edit</Link>
       <form action={removeCommunity}><input type="hidden" name="id" value={item.id}/><ConfirmSubmitButton message="Are you sure you want to delete this community?" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-panel">Delete</ConfirmSubmitButton></form>
      </div>
     </details>}
     <Link href={`/communities/${item.id}`} className="group block min-w-0">
      <div className="flex items-center justify-between"><Wifi aria-hidden="true" size={24} strokeWidth={2} className="text-[#26E7D4]"/><span className={isManager?"mr-10 text-xs font-normal uppercase text-muted":"text-xs font-normal uppercase text-muted"}>COMMUNITY</span></div>
      <h2 className="mt-7 break-words text-xl font-bold normal-case leading-snug text-ink [font-stretch:normal] group-hover:underline">{item.name}</h2>
      <p className="mt-6 flex items-center gap-2 text-base font-normal text-muted"><MapPin aria-hidden="true" size={18}/>{cityInfo?.name||place?.name||'City'} · {cityInfo?.country||place?.country_code||'Country'}</p>
      <p className="mt-6 text-base font-semibold text-gold">SDG 9: Industry, Innovation and Infrastructure</p>
     </Link>
     <div className="mt-7 border-t border-line pt-8">
      <div className="space-y-5">
       <p className="flex items-center gap-3 text-base text-muted"><UsersRound aria-hidden="true" size={19} className="shrink-0 text-[#26E7D4]"/><span>People connected: {metric(item.people_connected)}</span></p>
       <p className="flex items-center gap-3 text-base text-muted"><RadioTower aria-hidden="true" size={19} className="shrink-0 text-[#A78BFA]"/><span>Wi-Fi nodes: {metric(item.nodes)}</span></p>
      </div>
     </div>
     <div className="mt-auto pt-7">
      {joined&&<div role="status" className="flex min-h-16 w-full items-center justify-center gap-3 rounded-xl border border-[#26E7D4] bg-[#17312F] px-4 text-lg font-semibold text-[#26E7D4]"><CircleCheck aria-hidden="true" size={19}/>{managedIds.has(item.id)?'Managed · Joined':'Joined'}</div>}
      {joined&&!isManager&&leaveable.length>0&&<div className="mt-3 space-y-2">{leaveable.map(member=><form key={member.actor_id} action={leaveCommunityFromDirectory} className="text-center"><input type="hidden" name="community_id" value={item.id}/><input type="hidden" name="actor_id" value={member.actor_id}/><ConfirmSubmitButton message="Are you sure you want to leave this Wi-Fi Mesh Community?" className="text-sm text-muted underline underline-offset-4 hover:text-ink">Leave Community{leaveable.length>1?` · ${actors.find(actor=>actor.id===member.actor_id)?.name??'Account'}`:''}</ConfirmSubmitButton></form>)}</div>}
      {availableActors.length>0&&<form action={joinCommunityFromDirectory} className="space-y-2">
       <input type="hidden" name="community_id" value={item.id}/>
       {availableActors.length===1?<input type="hidden" name="actor_id" value={availableActors[0].id}/>:<select name="actor_id" aria-label={`Join ${item.name} as`} required className="w-full rounded-lg border border-line bg-panel-raised p-2 text-sm">{availableActors.map(actor=><option key={actor.id} value={actor.id}>{actor.name} · {actor.kind}</option>)}</select>}
       <button type="submit" className="flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-gold px-4 text-lg font-semibold text-navy hover:bg-gold-soft"><UserRoundPlus aria-hidden="true" size={21}/>Join Community</button>
      </form>}
      <Link href={`/communities/${item.id}`} className="mt-4 block text-center text-sm font-normal text-muted hover:text-gold">View community →</Link>
     </div>
    </article>;
   })}
  </div>
  {!communitiesError&&!communities?.length&&<p className="glass rounded-2xl p-6 text-muted">{queryText?'No communities match your search.':view==='managed'?'You do not manage any communities yet.':view==='joined'?'You have not joined any communities yet.':'No communities have been added here yet.'}</p>}
  {communities?.length===20&&<Link href={directoryUrl(view,selectedCity?.id,queryText,pageNumber+1)} className="text-gold">More communities →</Link>}
 </div>;
}
