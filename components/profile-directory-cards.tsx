import Link from 'next/link';
import { CircleCheck, Heart, MapPin, RadioTower, UsersRound, Wallet, Wifi } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { getCity } from '@/lib/cities';
import { DirectorySdgIcon } from '@/components/directory-sdg-icon';
import { money } from '@/lib/missions';
import { sdgLabel } from '@/lib/sdgs';
import { campaignTotal, type Total } from '@/lib/fundraising';
import { MissionParticipationControl } from '@/components/mission-participation-control';
import { ReferralShare } from '@/components/referral-share';

function SectionHeading({title,href,explore}:{title:string;href:string;explore:string}) {
 return <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
  <h2 className="text-xl font-bold text-ink">{title}</h2>
  <Link href={href} className="text-sm font-medium text-gold hover:underline">{explore} →</Link>
 </div>;
}
const card='relative flex h-full flex-col rounded-[18px] border border-line bg-panel p-[18px] text-ink';

export async function ProfileCommunityCards({actorId,createdOnly=false}:{actorId:string;createdOnly?:boolean}){
 const client=await createClient();
 const {data:memberships,error:membershipError}=await client.from('mesh_community_members').select('community_id,member_role').eq('actor_id',actorId).limit(1000);
 const ids=[...new Set((memberships??[]).filter(m=>!createdOnly||m.member_role==='steward').map(m=>m.community_id))];
 const {data:items,error}=ids.length
 ?await client.from('mesh_communities').select('id,name,city_id,location_text,people_connected,nodes,places(name,country_code,source_key)').in('id',ids).is('removed_at',null).order('created_at',{ascending:false}).limit(100)
 :{data:[],error:null};
 return <section>
  <SectionHeading title="Wi-Fi Mesh Communities" href="/communities" explore="Explore Communities"/>
  {(membershipError||error)&&<p role="alert" className="text-red-300">Could not load communities.</p>}
  <div className="grid gap-4 md:grid-cols-2">{(items??[]).map(item=>{
   const place=item.places as unknown as {name:string;country_code:string;source_key:string}|null;
   const city=place?.source_key?getCity(place.source_key):null;
   return <article key={item.id} className={card}>
    <Link href={'/communities/'+item.id} className="group block min-w-0">
     <div className="flex items-center justify-between"><Wifi aria-hidden="true" size={24} className="text-[#26E7D4]"/><span className="text-xs uppercase text-muted">COMMUNITY</span></div>
     <h3 className="mt-7 break-words text-xl font-bold leading-snug text-ink group-hover:underline">{item.name}</h3>
     <p className="mt-6 flex items-center gap-2 text-base text-muted"><MapPin size={18}/>{city?.name||place?.name||'City'} · {city?.country||place?.country_code||'Country'}</p>
     <p className="mt-6 text-base font-semibold text-gold">SDG 9: Industry, Innovation and Infrastructure</p>
    </Link>
    <div className="mt-7 space-y-5 border-t border-line pt-8">
     <p className="flex items-center gap-3 text-base text-muted"><UsersRound size={19} className="text-[#26E7D4]"/>People connected: {Number(item.people_connected??0).toLocaleString('en-US')}</p>
     <p className="flex items-center gap-3 text-base text-muted"><RadioTower size={19} className="text-[#A78BFA]"/>Wi-Fi nodes: {Number(item.nodes??0).toLocaleString('en-US')}</p>
    </div>
    <div className="mt-auto pt-7">
     <div className="flex min-h-16 items-center justify-center gap-3 rounded-xl border border-[#26E7D4] bg-[#17312F] px-4 text-lg font-semibold text-[#26E7D4]"><CircleCheck size={19}/>{createdOnly?'Organization community':'Member'}</div>
     <Link href={'/communities/'+item.id} className="mt-4 block text-center text-sm text-muted hover:text-gold">View Community →</Link>
    </div>
   </article>;
  })}</div>
  {!error&&!membershipError&&!items?.length&&<p className="glass rounded-2xl p-6 text-muted">No physical mesh community memberships yet.</p>}
 </section>;
}

export async function ProfileMissionCards({actorId,createdOnly=false}:{actorId:string;createdOnly?:boolean}){
 const client=await createClient();
 const [{data:created},{data:joined}]=await Promise.all([
  client.from('missions').select('id').eq('created_by_actor_id',actorId).is('removed_at',null).limit(100),
  createdOnly?Promise.resolve({data:[]}):client.from('mission_participations').select('mission_id').eq('actor_id',actorId).limit(100)
 ]);
 const ids=[...new Set([...(created??[]).map(m=>m.id),...(joined??[]).map(m=>m.mission_id)])];
 const {data:items,error}=ids.length?await client.from('missions')
  .select('id,title,goal,location_text,manual_place,manual_country,funding_goal_amount,currency_code,created_by_actor_id,places(name,source_key)')
  .in('id',ids).is('removed_at',null).order('created_at',{ascending:false}).limit(100):{data:[],error:null};
 const missionIds=(items??[]).map(m=>m.id);
 const {data:sdgRows}=missionIds.length?await client.from('mission_sdgs').select('mission_id,sdg_number').in('mission_id',missionIds).order('sdg_number'):{data:[]};
 const sdgs=new Map<string,number[]>();
 for(const row of sdgRows??[])sdgs.set(row.mission_id,[...(sdgs.get(row.mission_id)??[]),row.sdg_number]);
 const myActors=await ownedActors();
 const myActorIds=myActors.map(a=>a.id);
 const {data:myParticipations}=myActorIds.length&&missionIds.length?await client.from('mission_participations')
  .select('mission_id,actor_id,participation_kind').in('mission_id',missionIds).in('actor_id',myActorIds).limit(2000):{data:[]};
 return <section>
  <SectionHeading title="SDG Missions" href="/missions" explore="Explore Missions"/>
  {error&&<p role="alert" className="text-red-300">Could not load missions.</p>}
  <div className="grid gap-4 md:grid-cols-2">{(items??[]).map(m=>{
   const place=m.places as unknown as {name:string;source_key:string}|null;
   const city=place?.source_key?getCity(place.source_key):null;
   const where=m.manual_place&&m.manual_country?m.manual_place+', '+m.manual_country:city?city.name+', '+city.country:place?.name||m.location_text;
   const selected=sdgs.get(m.id)??[];
   const owned=myActorIds.includes(m.created_by_actor_id);
   return <article key={m.id} className={card+' p-5 sm:p-6'}>
    <Link href={'/missions/'+m.id} className="group block">
     <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className="flex size-14 items-center justify-center rounded-xl bg-[#1B3536]"><DirectorySdgIcon number={selected[0]??9} size={29}/></span><span className="text-xs uppercase text-muted">PRIMARY SDG · {selected[0]??'—'}</span></div>
      <div className="flex gap-2">{selected.slice(1,4).map(n=><span key={n} className="rounded-xl bg-panel-raised p-2"><DirectorySdgIcon number={n} size={23}/></span>)}</div>
     </div>
     <h3 className="mt-6 break-words text-[23px] font-bold leading-tight text-ink group-hover:underline">{m.title}</h3>
     <p className="mt-5 flex items-center gap-2 text-base text-muted"><MapPin size={18}/>{where}</p>
     <div className="mt-6 space-y-1">{selected.map((n,i)=><p key={n} className={i===0?'text-base text-gold':'text-base text-muted'}>{sdgLabel(n)}</p>)}</div>
     <div className="mt-7 border-t border-line pt-7"><p className="line-clamp-3 text-base leading-relaxed text-ink">{m.goal}</p></div>
     <p className="mt-5 flex items-center gap-3 text-base text-ink"><Wallet size={21} className="text-[#26E7D4]"/>Funding goal: {money(m.funding_goal_amount,m.currency_code)}</p>
    </Link>
    <div className="mt-auto pt-6">
     {owned&&<p className="mb-2 text-sm font-semibold text-gold">Created by you</p>}
     <MissionParticipationControl missionId={m.id} actors={myActors} participations={(myParticipations??[]).filter(p=>p.mission_id===m.id)}/>
     {!myActors.length&&<Link href={'/missions/'+m.id} className="text-sm text-gold">View Mission →</Link>}
    </div>
   </article>;
  })}</div>
  {!error&&!items?.length&&<p className="glass rounded-2xl p-6 text-muted">No SDG Missions connected to this profile yet.</p>}
 </section>;
}

export async function ProfileFundraisingCards({actorId,createdOnly=false}:{actorId:string;createdOnly?:boolean}){
 const client=await createClient();
 const [{data:created},{data:fundraisers}]=await Promise.all([
  client.from('fundraising_campaigns').select('id').eq('actor_id',actorId).is('removed_at',null).is('archived_at',null).limit(100),
  createdOnly?Promise.resolve({data:[]}):client.from('fundraisers').select('campaign_id').eq('actor_id',actorId).limit(100)
 ]);
 const ids=[...new Set([...(created??[]).map(c=>c.id),...(fundraisers??[]).map(f=>f.campaign_id)])];
 const {data:items,error}=ids.length?await client.from('fundraising_campaigns')
  .select('id,title,mission_id,goal_amount,currency_code,missions(title,manual_place,manual_country,places(name,source_key))')
  .in('id',ids).is('removed_at',null).is('archived_at',null).order('created_at',{ascending:false}).limit(100):{data:[],error:null};
 const missionIds=[...new Set((items??[]).map(c=>c.mission_id))];
 const {data:sdgRows}=missionIds.length?await client.from('mission_sdgs').select('mission_id,sdg_number').in('mission_id',missionIds).order('sdg_number'):{data:[]};
 const sdgs=new Map<string,number[]>();
 for(const r of sdgRows??[])sdgs.set(r.mission_id,[...(sdgs.get(r.mission_id)??[]),r.sdg_number]);
 const totals=await Promise.all((items??[]).map(async c=>{
  const {data}=await client.rpc('fundraising_totals',{p_campaign:c.id});
  return [c.id,campaignTotal((data??[]) as Total[])] as const;
 }));
 const raised=new Map(totals);
 return <section>
  <SectionHeading title="SDG Fundraising" href="/fundraising" explore="Explore Fundraising"/>
  {error&&<p role="alert" className="text-red-300">Could not load fundraising.</p>}
  <div className="grid gap-4 md:grid-cols-2">{(items??[]).map(c=>{
   const sdg=sdgs.get(c.mission_id)??[];
   const mission=c.missions as unknown as {manual_place:string|null;manual_country:string|null;places:{name:string;source_key:string}|null}|null;
   const city=mission?.places?.source_key?getCity(mission.places.source_key):null;
   const place=mission?.manual_place&&mission.manual_country?mission.manual_place+', '+mission.manual_country:city?city.name+', '+city.country:mission?.places?.name||'Location not specified';
   const total=raised.get(c.id)??{amount:0,count:0};
   const pct=Number(c.goal_amount)>0?Math.min(100,Math.round(total.amount/Number(c.goal_amount)*100)):0;
   const format=(value:number)=>new Intl.NumberFormat('en',{style:'currency',currency:c.currency_code,maximumFractionDigits:0}).format(value);
   return <article key={c.id} className={card}>
    <div className="flex items-center justify-between gap-2">
     <span className="flex size-[54px] items-center justify-center rounded-xl bg-[#1B3536]"><DirectorySdgIcon number={sdg[0]??9} size={29}/></span>
     <div className="flex items-center gap-3">{sdg.slice(1,4).map(n=><DirectorySdgIcon key={n} number={n} size={24}/>)}</div>
    </div>
    <p className="mt-5 text-xs font-semibold uppercase text-gold">SDG MISSION CAMPAIGN</p>
    <Link href={'/fundraising/campaigns/'+c.id}><h3 className="mt-2 break-words text-[21px] font-bold leading-tight text-ink hover:underline">{c.title}</h3></Link>
    <p className="mt-5 flex items-center gap-2 text-base text-muted"><MapPin size={18}/>{place}</p>
    <div className="mt-6 space-y-1">{sdg.map((n,i)=><p key={n} className={i===0?'text-sm text-ink':'text-sm text-muted'}>{sdgLabel(n)}</p>)}</div>
    <div className="mt-7 border-t border-line pt-8">
     <div className="flex flex-wrap items-baseline gap-3"><strong className="text-[27px] font-bold text-gold">{format(total.amount)}</strong><span className="text-sm text-muted">raised of {format(Number(c.goal_amount))}</span></div>
     <div role="progressbar" aria-label="Campaign funding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-3 h-3 overflow-hidden rounded-full bg-[#2A3040]"><div className="h-full rounded-full bg-[#26E7D4]" style={{width:pct+'%'}}/></div>
     <div className="mt-3 flex justify-between gap-2 text-sm text-muted"><span>{pct}% funded</span><span>{total.count} donors</span></div>
    </div>
    <div className="mt-auto pt-9">
     <Link href={'/fundraising/campaigns/'+c.id} className="flex min-h-[63px] w-full items-center justify-center gap-3 rounded-xl bg-gold px-4 text-lg font-semibold text-navy hover:bg-gold-soft"><Heart size={21}/>Donate</Link>
     <div className="mt-5 flex items-center justify-between gap-3">
      <div className="min-w-0 [&_button]:!bg-transparent [&_button]:!p-0 [&_button]:!text-base [&_button]:!font-normal [&_button]:!text-muted"><ReferralShare path={'/c/'+c.id} title={c.title} noun="campaign"/></div>
      <Link href={'/fundraising/campaigns/'+c.id} className="shrink-0 text-base font-medium text-gold hover:underline">View Campaign →</Link>
     </div>
    </div>
   </article>;
  })}</div>
  {!error&&!items?.length&&<p className="glass rounded-2xl p-6 text-muted">No fundraising campaigns connected to this profile yet.</p>}
 </section>;
}
