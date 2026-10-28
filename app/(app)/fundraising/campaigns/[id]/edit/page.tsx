import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import type { CampaignMissionInfo } from '@/components/campaign-mission-details';
import { CampaignCreationForm } from '@/components/campaign-creation-form';
import { editCampaign } from '../../../actions';
export default async function EditCampaign({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();
 const {data:campaign}=await client.from('fundraising_campaigns').select('id,actor_id,title,story,mission_id').eq('id',id).is('removed_at',null).is('archived_at',null).maybeSingle();
 if(!campaign)notFound();
 const actors=await ownedActors();if(!actors.some(a=>a.id===campaign.actor_id))notFound();
 const {data:mission}=await client.from('missions').select('id,created_by_actor_id,title,location_text,goal,roles_summary,starts_on,ends_on,budget_amount,funding_goal_amount,currency_code,manual_place,manual_country,community_id,places(name,source_key),mesh_communities(name),mission_sdgs(sdg_number)').eq('id',campaign.mission_id).maybeSingle();
 if(!mission)notFound();

 const {data:participations}=await client.from('mission_participations').select('mission_id,actor_id,participation_kind').eq('mission_id',campaign.mission_id).eq('actor_id',campaign.actor_id);
 return <div className="space-y-5"><Link href={`/fundraising/campaigns/${id}`} className="text-sm text-gold">← Campaign</Link>
 <Card title="Edit SDG Fundraising Campaign">
  <form action={editCampaign} className="max-w-2xl space-y-5">
   <input type="hidden" name="id" value={id}/>
   {error&&<p role="alert" className="text-amber-300">Could not save your changes.</p>}
   <CampaignCreationForm actors={actors} missions={[mission as unknown as CampaignMissionInfo]}
    participations={participations??[]} lockedMissionId={campaign.mission_id}
    editingCampaign={{id:campaign.id,title:campaign.title,story:campaign.story,actor_id:campaign.actor_id}}/>
  </form>
 </Card></div>;
}
