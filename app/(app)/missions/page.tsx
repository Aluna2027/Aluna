import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cities, getCity } from '@/lib/cities';
import { money,participationOptions } from '@/lib/missions';
import { joinMissionFromDirectory } from './actions';
import { Search } from 'lucide-react';
import { actorDetails,ownedActors } from '@/lib/social';
import { sdgLabel,sdgs,sdgColors } from '@/lib/sdgs';
export default async function Missions({searchParams}:{searchParams:Promise<{city?:string;community?:string;page?:string;q?:string;view?:string;sdg?:string;search?:string;status?:string;error?:string}>}) {
 const {city,community,page,q:rawQuery,view:rawView,sdg:rawSdg,search:searchOpen,status,error:actionError}=await searchParams;const client=await createClient();const selectedCity=cities.find(c=>c.id===city);const queryText=(rawQuery??'').trim().slice(0,120);

 const view=rawView==='participating'||rawView==='created'?rawView:'all';
 const sdgNumber=Number(rawSdg);const selectedSdg=Number.isInteger(sdgNumber)&&sdgNumber>=1&&sdgNumber<=17?sdgNumber:null;
 const actors=await ownedActors(),actorIds=actors.map(a=>a.id);
 const {data:myParticipations}=actorIds.length?await client.from('mission_participations').select('mission_id,actor_id,participation_kind').in('actor_id',actorIds).limit(3000):{data:[]};
 const participations=myParticipations??[];
 const joinedIds=[...new Set(participations.map(p=>p.mission_id))];
 const actorIdSet=new Set(actorIds);
 const params=(nextView=view,nextSdg=selectedSdg,nextQuery=queryText,nextPage=0,showSearch=false)=>{
  const p=new URLSearchParams();
  if(nextView!=='all')p.set('view',nextView);
  if(nextSdg)p.set('sdg',String(nextSdg));
  if(nextQuery)p.set('q',nextQuery);
  if(selectedCity)p.set('city',selectedCity.id);
  if(community)p.set('community',community);
  if(nextPage>0)p.set('page',String(nextPage));
  if(showSearch)p.set('search','1');
  const qs=p.toString();return qs?'/missions?'+qs:'/missions';
 };
 const {data:place}=selectedCity?await client.from('places').select('id').eq('source_key',selectedCity.id).maybeSingle():{data:null};
 const pageNumber=Math.max(0,Math.min(1000,Number.parseInt(page??'0',10)||0));
 let matchingPlaceIds:string[]=[];let matchingSdgMissionIds:string[]=[];
 if(queryText){const needle=queryText.toLocaleLowerCase('en');const matchingSourceKeys=cities.filter(c=>c.name.toLocaleLowerCase('en').includes(needle)||c.country.toLocaleLowerCase('en').includes(needle)||c.countryCode.toLocaleLowerCase('en').includes(needle)).map(c=>c.id);if(matchingSourceKeys.length){const {data:matchingPlaces}=await client.from('places').select('id').in('source_key',matchingSourceKeys.slice(0,500));matchingPlaceIds=(matchingPlaces??[]).map(item=>item.id);}const sdgMatch=needle.match(/^sdg\s*(\d{1,2})$/)||needle.match(/^(\d{1,2})$/);if(sdgMatch){const sdgNumber=Number(sdgMatch[1]);if(sdgNumber>=1&&sdgNumber<=17){const {data:sdgRows}=await client.from('mission_sdgs').select('mission_id').eq('sdg_number',sdgNumber).limit(500);matchingSdgMissionIds=(sdgRows??[]).map(row=>row.mission_id);}}}
 let query=client.from('missions').select('id,title,goal,location_text,funding_goal_amount,currency_code,city_id,manual_place,manual_country,community_id,created_by_actor_id,places(name,source_key)').is('removed_at',null).order('created_at',{ascending:false}).range(pageNumber*20,pageNumber*20+19);
 if(selectedCity){if(!place)return <p className="text-muted">This city is not available in the database yet.</p>;query=query.eq('city_id',place.id);}
 if(community&&/^[0-9a-f-]{36}$/i.test(community))query=query.eq('community_id',community);

 if(view==='created')query=actorIds.length?query.in('created_by_actor_id',actorIds):query.eq('id','00000000-0000-0000-0000-000000000000');
 if(view==='participating')query=joinedIds.length?query.in('id',joinedIds):query.eq('id','00000000-0000-0000-0000-000000000000');
 if(selectedSdg){const {data:matchingSdgs}=await client.from('mission_sdgs').select('mission_id').eq('sdg_number',selectedSdg).limit(3000);const ids=[...new Set((matchingSdgs??[]).map(v=>v.mission_id))];query=ids.length?query.in('id',ids):query.eq('id','00000000-0000-0000-0000-000000000000');}
 if(queryText){const safe=queryText.replace(/[%_,()]/g,' ').replace(/\s+/g,' ').trim();const filters=[safe?`title.ilike.%${safe}%`:null,safe?`manual_place.ilike.%${safe}%`:null,safe?`manual_country.ilike.%${safe}%`:null,matchingPlaceIds.length?`city_id.in.(${matchingPlaceIds.join(',')})`:null,matchingSdgMissionIds.length?`id.in.(${matchingSdgMissionIds.join(',')})`:null].filter(Boolean).join(',');if(filters)query=query.or(filters);else query=query.eq('id','00000000-0000-0000-0000-000000000000');}
 const {data:missions}=await query;
 const missionIds=(missions??[]).map(m=>m.id);
 const {data:sdgRows}=missionIds.length?await client.from('mission_sdgs').select('mission_id,sdg_number').in('mission_id',missionIds).order('sdg_number'):{data:[]};
 const sdgsByMission=new Map<string,number[]>();for(const row of sdgRows??[]){const values=sdgsByMission.get(row.mission_id)??[];values.push(row.sdg_number);sdgsByMission.set(row.mission_id,values);}
 const creatorDetails=await actorDetails((missions??[]).map(m=>m.created_by_actor_id));

 return <div className="space-y-6">
 <div className="text-center xl:hidden"><p className="deck-label">PEOPLE · PLACES · PURPOSE</p><h1 className="mt-1 text-3xl">SDG Missions</h1></div>
 {status==='joined'&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Mission participation saved.</p>}
 {actionError&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not join the mission. Please try again.</p>}
 <nav aria-label="SDG Mission categories" className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
 {([['All','all'],['Participating','participating'],['Created','created']] as const).map(([label,value])=><Link key={value} href={params(value)} aria-current={view===value?'page':undefined} className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm ${view===value?'bg-gold font-semibold text-navy':'glass'}`}>{label}</Link>)}
 </div>
 <div className="flex shrink-0 gap-2"><Link href={selectedCity?`/missions/new?city=${selectedCity.id}`:'/missions/new'} className="rounded-full border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">+ Create</Link><Link aria-label="Search SDG Missions" href={params(view,selectedSdg,queryText,0,true)+'#missions-search'} className="rounded-full border border-line bg-panel-raised p-2 text-gold"><Search size={18}/></Link></div>
 </nav>
 <div className="glass rounded-2xl p-4"><form method="get" className="flex flex-wrap items-center gap-3">{view!=='all'&&<input type="hidden" name="view" value={view}/>} {selectedCity&&<input type="hidden" name="city" value={selectedCity.id}/>} {community&&<input type="hidden" name="community" value={community}/>} {queryText&&<input type="hidden" name="q" value={queryText}/>}
 <label htmlFor="sdg-filter" className="text-sm font-semibold text-ink">Filter by SDG</label>
 <select id="sdg-filter" name="sdg" defaultValue={selectedSdg??''} className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-2 text-sm"><option value="">All 17 SDGs</option>{sdgs.map(g=><option key={g.number} value={g.number}>SDG {g.number}: {g.title}</option>)}</select>
 <button className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-navy">Apply</button>{selectedSdg&&<Link className="text-sm text-gold" href={params(view,null)}>Clear SDG</Link>}</form></div>
 <details id="missions-search" className="glass rounded-2xl p-4" open={Boolean(queryText)||searchOpen==='1'}><summary className="cursor-pointer text-sm font-semibold text-gold">Search SDG Missions</summary><form method="get" className="mt-3 flex flex-wrap gap-2">
 {view!=='all'&&<input type="hidden" name="view" value={view}/>}
 {selectedSdg&&<input type="hidden" name="sdg" value={selectedSdg}/>}
 {selectedCity&&<input type="hidden" name="city" value={selectedCity.id}/>}
 {community&&<input type="hidden" name="community" value={community}/>}
 <input name="q" aria-label="Search SDG Missions" defaultValue={queryText} placeholder="Search mission, SDG, place or country" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/>
 <button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Search</button>
 {queryText&&<Link className="rounded-xl border border-line px-4 py-3 text-gold" href={params(view,selectedSdg,'')}>Clear</Link>}
 </form></details>
 <div className="grid gap-4 md:grid-cols-2">{missions?.map(m=>{
 const place=m.places as unknown as {name:string;source_key:string}|null;
 const cityInfo=place?.source_key?getCity(place.source_key):null;
 const placeLabel=m.manual_place&&m.manual_country?`${m.manual_place}, ${m.manual_country}`:cityInfo?`${cityInfo.name}, ${cityInfo.country}`:place?.name??'City';
 const selected=sdgsByMission.get(m.id)??[];
 const participated=new Set(participations.filter(p=>p.mission_id===m.id).map(p=>p.actor_id));
 const available=actors.filter(a=>!participated.has(a.id));
 const owned=actorIdSet.has(m.created_by_actor_id);
 return <article key={m.id} className="glass rounded-2xl p-6">
  <Link href={`/missions/${m.id}`} className="block hover:underline">
   <p className="text-sm font-semibold text-gold">{placeLabel}</p>
   <div className="mt-3 flex flex-wrap gap-2">{selected.map(n=><span key={n} className="rounded-lg border px-2 py-1 text-xs font-semibold" style={{borderColor:sdgColors[n],color:sdgColors[n]}}>{sdgLabel(n)}</span>)}</div>
   <h2 className="mt-3 text-xl text-gold">{m.title}</h2>
   <p className="mt-2 text-sm text-ink">Created by {creatorDetails.get(m.created_by_actor_id)?.name||'Member'}</p>
   <p className="mt-3 line-clamp-2 text-sm text-gold">{m.goal}</p>
   <p className="mt-4 text-sm text-ink">Funding goal: {money(m.funding_goal_amount,m.currency_code)}</p>
  </Link>
  <div className="mt-4 border-t border-line pt-3">
   {owned&&<p className="mb-2 text-sm text-gold">Created by you</p>}
   {participated.size>0&&<p className="mb-2 text-sm font-semibold text-[#26E7D4]">Participating</p>}
   {actors.length>0&&<details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold text-gold">Join Mission — choose contribution types</summary><form action={joinMissionFromDirectory} className="mt-4 space-y-3">
    <input type="hidden" name="mission_id" value={m.id}/>
    <label className="block text-sm">Join as <select name="actor_id" required className="mt-1 w-full rounded-lg border border-line bg-panel-raised p-2">{actors.map(actor=><option key={actor.id} value={actor.id}>{actor.name} · {actor.kind}</option>)}</select></label>
    <fieldset><legend className="mb-2 text-sm">Choose one or more participation types</legend><div className="grid gap-2 sm:grid-cols-2">{participationOptions.map((o,i)=><label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel-raised p-3 text-xs"><input type="checkbox" name="participation_kind" value={o.value} className="accent-[#FFC43D]"/><span style={{color:['#FFC43D','#26E7D4','#8A4DFF','#35F3FF','#FF4FD8','#6A7CFF'][i]}}>{o.label}</span></label>)}</div></fieldset>
    <button className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy">Confirm Participation</button>
   </form></details>}
  </div>
 </article>})}</div>
 {!missions?.length&&<p className="glass rounded-2xl p-6 text-muted">{queryText?'No SDG Missions match your search.':view==='participating'?'You have no mission participations yet.':view==='created'?'You have not created any missions yet.':'No SDG Missions have been added here yet.'}</p>}
 {missions?.length===20&&<Link href={params(view,selectedSdg,queryText,pageNumber+1)} className="text-gold">More SDG Missions →</Link>}
 </div>;
}
