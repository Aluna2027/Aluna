import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { CampaignCreationForm } from '@/components/campaign-creation-form';
import type { CampaignMissionInfo } from '@/components/campaign-mission-details';
import { createCampaign } from '../../actions';

export default async function NewCampaign({searchParams}:{searchParams:Promise<{mission?:string;error?:string;organization?:string}>}) {
 const {mission,error,organization}=await searchParams;
 const client=await createClient();
 const allActors=await ownedActors();
 const actors=organization?allActors.filter(a=>a.href===`/organizations/${organization}`):allActors;
 const selected=mission&&/^[0-9a-f-]{36}$/i.test(mission)?mission:null;
 let query=client.from('missions').select('id,created_by_actor_id,title,location_text,goal,roles_summary,starts_on,ends_on,budget_amount,funding_goal_amount,currency_code,manual_place,manual_country,community_id,places(name,source_key),mesh_communities(name),mission_sdgs(sdg_number)').is('removed_at',null).order('created_at',{ascending:false}).limit(1000);
 if(selected)query=query.eq('id',selected);
 const {data:rows}=await query;
 if(selected&&!rows?.length)notFound();
 const missions=(rows??[]) as unknown as CampaignMissionInfo[];
 const {data:participations}=actors.length?await client.from('mission_participations').select('mission_id,actor_id,participation_kind').in('actor_id',actors.map(a=>a.id)).limit(10000):{data:[]};
 return <div className="space-y-5"><Link href="/fundraising" className="text-sm text-gold">← Fundraising</Link>
 <Card title="Create SDG Fundraising Campaign">
  <p className="mb-5 text-sm text-muted">Create an independent campaign for any SDG Mission. Join the mission as Fundraising, or choose other roles as well.</p>
  <form action={createCampaign} className="max-w-2xl space-y-5">
   {organization&&<input type="hidden" name="organization_id" value={organization}/>}
   {error&&<p role="alert" className="text-amber-300">Could not create the campaign. Check the mission, participation, funding goal and details.</p>}
   <CampaignCreationForm actors={actors} missions={missions} participations={participations??[]} lockedMissionId={selected}/>
  </form>
 </Card></div>;
}
