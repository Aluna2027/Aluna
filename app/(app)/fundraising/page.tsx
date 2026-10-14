import Link from 'next/link';
import { Search, Heart, MapPin } from 'lucide-react';
import { DirectorySdgIcon } from '@/components/directory-sdg-icon';
import { createClient } from '@/lib/supabase/server';
import { Progress, campaignTotal, type Total } from '@/lib/fundraising';
import { cities, getCity } from '@/lib/cities';
import { actorDetails, ownedActors } from '@/lib/social';
import { sdgs, sdgLabel } from '@/lib/sdgs';
import { ReferralShare } from '@/components/referral-share';

type View = 'all' | 'campaigns' | 'fundraisers';
type FundraiserRow = {id:string;campaign_id:string;slug:string;title:string;goal_amount:number};
type MissionRelation = {
 title:string;
 manual_place:string|null;
 manual_country:string|null;
 places:{name:string;source_key:string}|null;
};

function fundraisingUrl(view:View,sdg:number|null,q:string,page=0,showSearch=false) {
 const params=new URLSearchParams();
 if(view!=='all')params.set('view',view);
 if(sdg)params.set('sdg',String(sdg));
 if(q)params.set('q',q);
 if(page>0)params.set('page',String(page));
 if(showSearch)params.set('search','1');
 const text=params.toString();
 return text?'/fundraising?'+text:'/fundraising';
}

export default async function Fundraising({searchParams}:{searchParams:Promise<{page?:string;view?:string;sdg?:string;q?:string;search?:string;status?:string}>}) {
 const {page,view:rawView,sdg:rawSdg,q:rawQuery,search:searchOpen,status}=await searchParams;
 const offset=Math.max(0,Math.min(1000,Number.parseInt(page??'0',10)||0));
 const view:View=rawView==='campaigns'||rawView==='fundraisers'?rawView:'all';
 const queryText=(rawQuery??'').trim().slice(0,120);
 const safeQuery=queryText.replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
 const sdgNumber=Number(rawSdg);
 const selectedSdg=Number.isInteger(sdgNumber)&&sdgNumber>=1&&sdgNumber<=17?sdgNumber:null;
 const client=await createClient();
 const actors=await ownedActors();
 const actorIds=actors.map(actor=>actor.id);
 const {data:myFundraiserRows,error:fundraisersError}=actorIds.length
  ?await client.from('fundraisers').select('id,campaign_id,slug,title,goal_amount').in('actor_id',actorIds).order('created_at',{ascending:false}).limit(2000)
  :{data:[] as FundraiserRow[],error:null};
 const myFundraisers=(myFundraiserRows??[]) as FundraiserRow[];
 const fundraiserCampaignIds=[...new Set(myFundraisers.map(f=>f.campaign_id))];

 let matchingSdgMissionIds:string[]=[];
 if(selectedSdg){
  const {data}=await client.from('mission_sdgs').select('mission_id').eq('sdg_number',selectedSdg).limit(3000);
  matchingSdgMissionIds=[...new Set((data??[]).map(row=>row.mission_id))];
 }

 let matchingMissionIds:string[]=[];
 if(safeQuery){
  const needle=safeQuery.toLocaleLowerCase('en');
  const citySourceKeys=cities.filter(city=>city.name.toLocaleLowerCase('en').includes(needle)||city.country.toLocaleLowerCase('en').includes(needle)||city.countryCode.toLocaleLowerCase('en').includes(needle)).map(city=>city.id).slice(0,300);
  const {data:matchingPlaces}=citySourceKeys.length?await client.from('places').select('id').in('source_key',citySourceKeys):{data:[]};
  const placeIds=(matchingPlaces??[]).map(place=>place.id);
  const missionFilters=[`title.ilike.%${safeQuery}%`,`location_text.ilike.%${safeQuery}%`,`manual_place.ilike.%${safeQuery}%`,`manual_country.ilike.%${safeQuery}%`];
  if(placeIds.length)missionFilters.push(`city_id.in.(${placeIds.join(',')})`);
  const {data:matchedMissions}=await client.from('missions').select('id').is('removed_at',null).or(missionFilters.join(',')).limit(1000);
  matchingMissionIds=(matchedMissions??[]).map(mission=>mission.id);
  const sdgMatches=sdgs.filter(item=>`sdg ${item.number}: ${item.title}`.toLocaleLowerCase('en').includes(needle)||item.title.toLocaleLowerCase('en').includes(needle)||String(item.number)===needle).map(item=>item.number);
  if(sdgMatches.length){
   const {data:sdgMissions}=await client.from('mission_sdgs').select('mission_id').in('sdg_number',sdgMatches).limit(2000);
   matchingMissionIds.push(...(sdgMissions??[]).map(row=>row.mission_id));
  }
  matchingMissionIds=[...new Set(matchingMissionIds)];
 }

 let query=client.from('fundraising_campaigns')
  .select('id,title,story,goal_amount,currency_code,mission_id,actor_id,missions(title,manual_place,manual_country,places(name,source_key))')
  .is('removed_at',null).is('archived_at',null)
  .order('created_at',{ascending:false}).range(offset*20,offset*20+19);
 if(view==='campaigns')query=actorIds.length?query.in('actor_id',actorIds):query.eq('id','00000000-0000-0000-0000-000000000000');
 if(view==='fundraisers')query=fundraiserCampaignIds.length?query.in('id',fundraiserCampaignIds):query.eq('id','00000000-0000-0000-0000-000000000000');
 if(selectedSdg)query=matchingSdgMissionIds.length?query.in('mission_id',matchingSdgMissionIds):query.eq('id','00000000-0000-0000-0000-000000000000');
 if(safeQuery){
  const filters=[`title.ilike.%${safeQuery}%`];
  if(matchingMissionIds.length)filters.push(`mission_id.in.(${matchingMissionIds.slice(0,1000).join(',')})`);
  query=query.or(filters.join(','));
 }else if(queryText)query=query.eq('id','00000000-0000-0000-0000-000000000000');

 const {data:campaigns,error:campaignsError}=await query;
 const missionIds=[...new Set((campaigns??[]).map(c=>c.mission_id))];
 const {data:sdgRows}=missionIds.length?await client.from('mission_sdgs').select('mission_id,sdg_number').in('mission_id',missionIds).order('sdg_number'):{data:[]};
 const sdgsByMission=new Map<string,number[]>();
 for(const row of sdgRows??[]){
  const values=sdgsByMission.get(row.mission_id)??[];
  values.push(row.sdg_number);sdgsByMission.set(row.mission_id,values);
 }
 const totals=await Promise.all((campaigns??[]).map(async campaign=>{
  const {data}=await client.rpc('fundraising_totals',{p_campaign:campaign.id});
  return [campaign.id,(data??[]) as Total[]] as const;
 }));
 const raised=new Map(totals.map(([campaignId,rows])=>[campaignId,campaignTotal(rows)] as const));
 const byFundraiser=new Map(totals.flatMap(([,rows])=>rows.filter(row=>row.fundraiser_id!==null).map(row=>[row.fundraiser_id as string,row] as const)));
 const creatorDetails=await actorDetails((campaigns??[]).map(c=>c.actor_id));

 return <div className="space-y-6">
  {status==='archived'&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Campaign archived.</p>}
  {status==='removed'&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Campaign removed.</p>}
  <nav aria-label="Fundraising views" className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
    {([['All','all'],['My Campaigns','campaigns'],['My Fundraisers','fundraisers']] as const).map(([label,value])=><Link key={value} href={fundraisingUrl(value,selectedSdg,queryText)} aria-current={view===value?'page':undefined} className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm ${view===value?'bg-gold font-semibold text-navy':'glass hover:border-gold'}`}>{label}</Link>)}
    <Link href="/fundraising/performance" className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm glass hover:border-gold">Performance</Link>
   </div>
   <div className="flex shrink-0 gap-2">
    <Link href="/fundraising/campaigns/new" className="rounded-full border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">+ Create</Link>
    <Link href={fundraisingUrl(view,selectedSdg,queryText,0,true)+'#fundraising-search'} aria-label="Search SDG Fundraising" className="rounded-full border border-line bg-panel-raised p-2 text-gold hover:border-gold"><Search size={18}/></Link>
   </div>
  </nav>
  <div className="glass rounded-2xl p-4">
   <form method="get" className="flex flex-wrap items-center gap-3">
    {view!=='all'&&<input type="hidden" name="view" value={view}/>}
    {queryText&&<input type="hidden" name="q" value={queryText}/>}
    <label htmlFor="fundraising-sdg-filter" className="text-sm font-semibold text-ink">Filter by SDG</label>
    <select id="fundraising-sdg-filter" name="sdg" defaultValue={selectedSdg??''} className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-2 text-sm">
     <option value="">All 17 SDGs</option>
     {sdgs.map(sdg=><option key={sdg.number} value={sdg.number}>{sdgLabel(sdg.number)}</option>)}
    </select>
    <button className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-navy">Apply</button>
    {selectedSdg&&<Link href={fundraisingUrl(view,null,queryText)} className="text-sm text-gold">Clear SDG</Link>}
   </form>
  </div>
  <details id="fundraising-search" className="glass rounded-2xl p-4" open={Boolean(queryText)||searchOpen==='1'}>
   <summary className="cursor-pointer text-sm font-semibold text-gold">Search SDG Fundraising</summary>
   <form method="get" className="mt-3 flex flex-wrap gap-2">
    {view!=='all'&&<input type="hidden" name="view" value={view}/>}
    {selectedSdg&&<input type="hidden" name="sdg" value={selectedSdg}/>}
    <input name="q" aria-label="Search campaigns, missions, cities, countries or SDGs" defaultValue={queryText} placeholder="Search campaign, mission, city, country or SDG" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/>
    <button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Search</button>
    {queryText&&<Link href={fundraisingUrl(view,selectedSdg,'')} className="rounded-xl border border-line px-4 py-2 text-gold">Clear</Link>}
   </form>
  </details>
  {fundraisersError&&<p role="alert" className="text-red-300">Your fundraisers could not be loaded.</p>}
  {campaignsError&&<p role="alert" className="text-red-300">Fundraising campaigns could not be loaded.</p>}
  <div className="grid gap-4 md:grid-cols-2">
   {campaigns?.map(c=>{
    const total=raised.get(c.id)??{amount:0,count:0};
    const mission=c.missions as unknown as MissionRelation|null;
    const cityInfo=mission?.places?.source_key?getCity(mission.places.source_key):null;
    const placeLabel=mission?.manual_place&&mission.manual_country?`${mission.manual_place}, ${mission.manual_country}`:cityInfo?`${cityInfo.name}, ${cityInfo.country}`:mission?.places?.name??'Location not specified';
    const relatedFundraisers=myFundraisers.filter(f=>f.campaign_id===c.id);
    const selectedSdgs=sdgsByMission.get(c.mission_id)??[];
    const pct=Number(c.goal_amount)>0?Math.min(100,Math.round(total.amount/Number(c.goal_amount)*100)):0;
    return <article key={c.id} className="flex h-full flex-col rounded-[18px] border border-line bg-panel p-[18px] text-ink">
     <div className="flex items-center justify-between gap-2">
      <span className="flex size-[54px] items-center justify-center rounded-xl bg-[#1B3536]"><DirectorySdgIcon number={selectedSdgs[0]??9} size={29}/></span>
      <div className="flex items-center gap-3">{selectedSdgs.slice(1,4).map(n=><DirectorySdgIcon key={n} number={n} size={24}/>)}</div>
     </div>
     <p className="mt-5 text-xs font-semibold uppercase text-gold">SDG MISSION CAMPAIGN</p>
     <h2 className="mt-2 break-words text-[21px] font-bold normal-case leading-tight text-ink [font-stretch:normal]">{c.title}</h2>
     <p className="mt-5 flex items-center gap-2 text-base text-muted"><MapPin aria-hidden="true" size={18}/>{placeLabel}</p>
     <div className="mt-6 space-y-1">{selectedSdgs.map((n,i)=><p key={n} className={i===0?'text-sm text-ink':'text-sm text-muted'}>{sdgLabel(n)}</p>)}</div>
     <div className="mt-7 border-t border-line pt-8">
      <div className="flex flex-wrap items-baseline gap-3"><strong className="text-[27px] font-bold text-gold">{new Intl.NumberFormat('en',{style:'currency',currency:c.currency_code,maximumFractionDigits:0}).format(total.amount)}</strong><span className="text-sm text-muted">raised of {new Intl.NumberFormat('en',{style:'currency',currency:c.currency_code,maximumFractionDigits:0}).format(Number(c.goal_amount))}</span></div>
      <div role="progressbar" aria-label="Campaign funding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-3 h-3 overflow-hidden rounded-full bg-[#2A3040]"><div className="h-full rounded-full bg-[#26E7D4]" style={{width:`${pct}%`}}/></div>
      <div className="mt-3 flex justify-between gap-2 text-sm text-muted"><span>{pct}% funded</span><span>{total.count} donors</span></div>
     </div>
     {view==='fundraisers'&&relatedFundraisers.length>0&&<div className="mt-4 space-y-3 border-t border-line pt-3">{relatedFundraisers.map(f=>{const personal=byFundraiser.get(f.id);return <div key={f.id} className="rounded-xl border border-line p-3"><Link href={`/fundraising/${f.slug}`} className="mb-2 block text-sm font-semibold text-gold hover:underline">Your fundraiser: {f.title} →</Link><Progress amount={Number(personal?.amount_raised??0)} count={Number(personal?.donor_count??0)} goal={Number(f.goal_amount)} currency={c.currency_code}/></div>})}</div>}
     <div className="mt-auto pt-9">
      <Link href={`/fundraising/campaigns/${c.id}`} className="flex min-h-[63px] w-full items-center justify-center gap-3 rounded-xl bg-gold px-4 text-lg font-semibold text-navy hover:bg-gold-soft"><Heart aria-hidden="true" size={21}/>Donate</Link>
      <div className="mt-5 flex items-center justify-between gap-3">
       <div className="min-w-0 [&_button]:!bg-transparent [&_button]:!p-0 [&_button]:!text-base [&_button]:!font-normal [&_button]:!text-muted"><ReferralShare path={`/c/${c.id}`} title={c.title} noun="campaign"/></div>
       <Link href={`/fundraising/campaigns/${c.id}`} className="shrink-0 text-base font-medium text-gold hover:underline">View Campaign →</Link>
      </div>
     </div>
    </article>;
   })}
  </div>
  {!campaignsError&&!campaigns?.length&&<p className="glass rounded-2xl p-6 text-muted">{queryText||selectedSdg?'No fundraising campaigns match these filters.':view==='campaigns'?'You have not created any campaigns yet.':view==='fundraisers'?'You have not started any fundraisers yet.':'No fundraising campaigns yet.'}</p>}
  {campaigns?.length===20&&<Link href={fundraisingUrl(view,selectedSdg,queryText,offset+1)} className="text-gold">More campaigns →</Link>}
 </div>;
}
