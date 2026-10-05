import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { FundraisingFields } from '@/components/fundraising-fields';
import { createCampaign } from '../../actions';

export default async function NewCampaign({searchParams}:{searchParams:Promise<{mission?:string;error?:string}>}) {
 const {mission,error}=await searchParams;
 const client=await createClient();
 const actors=await ownedActors();
 const ids=actors.map(a=>a.id);
 const {data:ownedMissions}=ids.length
  ?await client.from('missions').select('id,title,created_by_actor_id,currency_code').in('created_by_actor_id',ids).order('created_at',{ascending:false}).limit(100)
  :{data:[]};
 const {data:selectedMission}=mission&&/^[0-9a-f-]{36}$/i.test(mission)
  ?await client.from('missions').select('id,title,created_by_actor_id,currency_code').eq('id',mission).maybeSingle()
  :{data:null};
 const missionMap=new Map((ownedMissions??[]).map(item=>[item.id,item]));
 if(selectedMission)missionMap.set(selectedMission.id,selectedMission);
 const missions=[...missionMap.values()];
 return <div className="space-y-5">
  <Link href="/fundraising" className="text-sm text-gold">← Fundraising</Link>
  <Card title="Create mission fundraising campaign">
   <p className="mb-5">A campaign belongs to a mission. You can create a fundraising campaign for any mission you open from its Mission page.</p>
   <form action={createCampaign} className="max-w-2xl space-y-5">
    {error&&<p role="alert" className="text-amber-300">Could not create the campaign. Check the details, mission and campaign owner.</p>}
    <label className="block text-sm">Mission
     <select name="mission_id" required defaultValue={selectedMission?.id??mission??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">
      <option value="" disabled>Select mission</option>
      {missions.map(m=><option key={m.id} value={m.id}>{m.title} · {m.currency_code}</option>)}
     </select>
    </label>
    <label className="block text-sm">Create as
     <select name="actor_id" required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">
      {actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}
     </select>
    </label>
    <FundraisingFields/>
    <button disabled={!missions.length||!actors.length} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Create campaign</button>
   </form>
  </Card>
 </div>;
}
