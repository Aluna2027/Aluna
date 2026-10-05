import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { getCity } from '@/lib/cities';
import { Card } from '@/components/ui';
import { FundraisingFields } from '@/components/fundraising-fields';
import { CampaignMissionSelector } from '@/components/campaign-mission-selector';
import { sdgLabel } from '@/lib/sdgs';
import { createCampaign } from '../../actions';

type MissionOption={
 id:string;
 title:string;
 created_by_actor_id:string;
 currency_code:string;
 manual_place:string|null;
 manual_country:string|null;
 places:{name:string;source_key:string}|null;
 mission_sdgs:{sdg_number:number}[]|null;
};

function missionLocation(mission:MissionOption){
 if(mission.manual_place&&mission.manual_country)return `${mission.manual_place}, ${mission.manual_country}`;
 const city=mission.places?.source_key?getCity(mission.places.source_key):null;
 return city?`${city.name}, ${city.country}`:mission.places?.name??'Location not specified';
}

export default async function NewCampaign({searchParams}:{searchParams:Promise<{mission?:string;error?:string}>}) {
 const {mission,error}=await searchParams;
 const client=await createClient();
 const actors=await ownedActors();
 const ids=actors.map(a=>a.id);
 const lockedMissionId=mission&&/^[0-9a-f-]{36}$/i.test(mission)?mission:null;

 const {data:selectedRow}=lockedMissionId
  ?await client.from('missions').select('id,title,created_by_actor_id,currency_code,manual_place,manual_country,places(name,source_key),mission_sdgs(sdg_number)').eq('id',lockedMissionId).maybeSingle()
  :{data:null};

 if(lockedMissionId&&!selectedRow)notFound();

 const selectedMission=selectedRow as unknown as MissionOption|null;
 const {data:ownedRows}=!lockedMissionId&&ids.length
  ?await client.from('missions').select('id,title,created_by_actor_id,currency_code,manual_place,manual_country,places(name,source_key),mission_sdgs(sdg_number)').in('created_by_actor_id',ids).order('created_at',{ascending:false}).limit(100)
  :{data:[]};
 const ownedMissions=(ownedRows??[]) as unknown as MissionOption[];
 const missionChoices=(selectedMission?[selectedMission]:ownedMissions).map(m=>({id:m.id,title:m.title,location:missionLocation(m),sdgs:(m.mission_sdgs??[]).map(row=>sdgLabel(Number(row.sdg_number)))}));

 return <div className="space-y-5">
  <Link href="/fundraising" className="text-sm text-gold">← Fundraising</Link>
  <Card title="Create SDG mission fundraising campaign">
   <p className="mb-5">A campaign belongs to a SDG mission. You can create a fundraising campaign for any SDG mission you open from its SDG Mission page.</p>
   <form action={createCampaign} className="max-w-2xl space-y-5">
    {error&&<p role="alert" className="text-amber-300">Could not create the campaign. Check the details, mission and campaign owner.</p>}

    <CampaignMissionSelector missions={missionChoices} lockedMissionId={selectedMission?.id??null}/>

    <label className="block text-sm">Create as
     <select name="actor_id" required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">
      {actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}
     </select>
    </label>
    <FundraisingFields/>
    <button disabled={!actors.length||(!selectedMission&&!ownedMissions.length)} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Create campaign</button>
   </form>
  </Card>
 </div>;
}
