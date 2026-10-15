import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cities, getCity } from '@/lib/cities';
import { money } from '@/lib/missions';
import { MissionParticipationControl } from '@/components/mission-participation-control';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { removeMission } from './actions';
import { MapPin, Wallet } from 'lucide-react';
import { DirectorySdgIcon } from '@/components/directory-sdg-icon';
import { ownedActors } from '@/lib/social';
import { sdgLabel,sdgs,sdgColors } from '@/lib/sdgs';
export default async function Missions({searchParams}:{searchParams:Promise<{city?:string;community?:string;page?:string;q?:string;view?:string;sdg?:string;search?:string;status?:string;error?:string}>}) {
 const {city,community,page,q:rawQuery,view:rawView,sdg:rawSdg,search:searchOpen,status,error:actionError}=await searchParams;const client=await createClient();const selectedCity=cities.find(c=>c.id===city);const queryText=(rawQuery??'').trim().slice(0,120);

 const view=rawView==='participating'||rawView==='created'?rawView:'all';
 const sdgNumber=Number(rawSdg);const selectedSdg=Number.isInteger(sdgNumber)&&sdgNumber>=1&&sdgNumber<=17?sdgNumber:null;
 const actors=await ownedActors(),actorIds=actors.map(a=>a.id);
 const {data:myParticipations}=actorIds.length?await client.from('mission_participations').select('mission_id,actor_id,participation_kind').in('actor_id',actorIds).limit(3000):{data:[]};
 const participations=myParticipations??[];
 const joinedIds=[...new Set(participations.map(p=>p.mission_id))];
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

 return <div className="space-y-6">
 <div className="text-center xl:hidden"><p className="deck-label">PEOPLE · PLACES · PURPOSE</p><h1 className="mt-1 text-3xl">SDG Missions</h1></div>
 {status==='left'&&<p role="status" className="rounded-xl border border-[#26E7D4] p-3 text-[#26E7D4]">Mission participation ended.</p>}
 {status==='joined'&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Mission participation saved.</p>}
 {actionError&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not join the mission. Please try again.</p>}
 <nav aria-label="SDG Mission categories" className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
 {([['All','all'],['Participating','participating'],['Created','created']] as const).map(([label,value])=><Link key={value} href={params(value)} aria-current={view===value?'page':undefined} className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm ${view===value?'bg-gold font-semibold text-navy':'glass'}`}>{label}</Link>)}
 </div>
 <div className="flex shrink-0 gap-2"><Link href={selectedCity?`/missions/new?city=${selectedCity.id}`:'/missions/new'} className="rounded-full border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">+ Create</Link></div>
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
 const owned=actorIds.includes(m.created_by_actor_id);
 return <article key={m.id} className="relative flex h-full flex-col rounded-[18px] border border-line bg-panel p-5 text-ink sm:p-6">
  {owned&&<details className="absolute right-4 top-4 z-20 text-sm">
   <summary aria-label={`Manage mission ${m.title}`} className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-line bg-panel-raised text-xl text-ink hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">⋯</summary>
   <div className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-panel p-2 shadow-xl">
    <Link href={`/missions/${m.id}/edit`} className="block rounded-lg px-3 py-2 text-gold hover:bg-panel-raised">Edit Mission</Link>
    <form action={removeMission}>
     <input type="hidden" name="id" value={m.id}/>
     <ConfirmSubmitButton message="Delete this mission? Its unfunded fundraising campaigns will also be removed. Deletion is blocked when protected financial activity or proof exists." className="w-full rounded-lg px-3 py-2 text-left text-[#E49BA3] hover:bg-panel-raised">Delete Mission</ConfirmSubmitButton>
    </form>
   </div>
  </details>}
  <Link href={`/missions/${m.id}`} className="group block">
   <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3"><span className="flex size-14 items-center justify-center rounded-xl bg-[#1B3536]"><DirectorySdgIcon number={selected[0]??9} size={29}/></span><span className="text-xs uppercase text-muted">PRIMARY SDG · {selected[0]??'—'}</span></div>
    <div className={owned?"flex gap-3 pr-10":"flex gap-3"}>{selected.slice(1,4).map(n=><span key={n} className="rounded-xl bg-panel-raised p-2"><DirectorySdgIcon number={n} size={23}/></span>)}</div>
   </div>
   <h2 className="mt-6 break-words text-[23px] font-bold normal-case leading-tight text-ink [font-stretch:normal] group-hover:underline">{m.title}</h2>
   <p className="mt-5 flex items-center gap-2 text-base text-muted"><MapPin aria-hidden="true" size={18}/>{placeLabel}</p>
   <div className="mt-6 space-y-1">{selected.map((n,i)=><p key={n} className={i===0?'text-base text-gold':'text-base text-muted'}>{sdgLabel(n)}</p>)}</div>
   <div className="mt-7 border-t border-line pt-7"><p className="line-clamp-3 text-base leading-relaxed text-ink">{m.goal}</p></div>
   <p className="mt-5 flex items-center gap-3 text-base text-ink"><Wallet aria-hidden="true" className="text-[#26E7D4]" size={21}/>Funding goal: {money(m.funding_goal_amount,m.currency_code)}</p>
  </Link>
  <div className="mt-auto pt-6">
   {owned&&<p className="mb-2 text-sm font-semibold text-gold">Created by you</p>}
   <MissionParticipationControl missionId={m.id} actors={actors} participations={participations.filter(p=>p.mission_id===m.id)}/>
  </div>
 </article>})}</div>
 {!missions?.length&&<p className="glass rounded-2xl p-6 text-muted">{queryText?'No SDG Missions match your search.':view==='participating'?'You have no mission participations yet.':view==='created'?'You have not created any missions yet.':'No SDG Missions have been added here yet.'}</p>}
 {missions?.length===20&&<Link href={params(view,selectedSdg,queryText,pageNumber+1)} className="text-gold">More SDG Missions →</Link>}
 </div>;
}
