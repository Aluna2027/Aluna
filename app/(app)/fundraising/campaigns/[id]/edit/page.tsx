import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { CampaignMissionDetails,type CampaignMissionInfo } from '@/components/campaign-mission-details';
import { editCampaign } from '../../../actions';
export default async function EditCampaign({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();
 const {data:campaign}=await client.from('fundraising_campaigns').select('id,actor_id,title,story,mission_id').eq('id',id).is('removed_at',null).is('archived_at',null).maybeSingle();
 if(!campaign)notFound();
 const actors=await ownedActors();if(!actors.some(a=>a.id===campaign.actor_id))notFound();
 const {data:mission}=await client.from('missions').select('id,created_by_actor_id,title,location_text,goal,roles_summary,starts_on,ends_on,budget_amount,funding_goal_amount,currency_code,manual_place,manual_country,community_id,places(name,source_key),mesh_communities(name),mission_sdgs(sdg_number)').eq('id',campaign.mission_id).maybeSingle();
 if(!mission)notFound();
 return <div className="space-y-5"><Link href={`/fundraising/campaigns/${id}`} className="text-sm text-gold">← Campaign</Link>
 <Card title="Edit SDG Fundraising Campaign">
  <form action={editCampaign} className="max-w-2xl space-y-5"><input type="hidden" name="id" value={id}/>
  {error&&<p role="alert" className="text-amber-300">Could not save your changes.</p>}
  <CampaignMissionDetails mission={mission as unknown as CampaignMissionInfo}/>
  <label className="block text-sm">Create as<input readOnly value={actors.find(a=>a.id===campaign.actor_id)?.name??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <p className="text-sm text-muted">Participation and mission details are managed through the SDG Mission. Historical campaign ownership is preserved.</p>
  <label className="block text-sm">Campaign Title<input name="title" required minLength={3} maxLength={180} defaultValue={campaign.title} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Campaign Story<textarea name="story" required minLength={10} maxLength={5000} rows={5} defaultValue={campaign.story} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Save Campaign</button></form>
 </Card></div>;
}
