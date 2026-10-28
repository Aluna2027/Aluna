import { MissionFundingHelp } from '@/components/mission-funding-help';
import { money } from '@/lib/missions';

export type CampaignMissionInfo={id:string;created_by_actor_id:string;title:string;location_text:string;goal:string;roles_summary:string|null;starts_on:string|null;ends_on:string|null;budget_amount:number|null;funding_goal_amount:number|null;currency_code:string;manual_place:string|null;manual_country:string|null;community_id:string|null;places:{name:string;source_key:string}|null;mesh_communities:{name:string}|null;mission_sdgs:{sdg_number:number}[]|null};
export function CampaignMissionDetails({mission}:{mission:CampaignMissionInfo}){
 const location=mission.manual_place&&mission.manual_country?`${mission.manual_place}, ${mission.manual_country}`:mission.places?.name??'Not specified';
 const details:[string,string][]=[
  ['Place and Country',location],
  ['Wi-Fi Mesh Community',mission.mesh_communities?.name??'No linked community'],
  ['SDGs',(mission.mission_sdgs??[]).map(x=>`SDG ${x.sdg_number}`).join(', ')||'Not specified'],
  ['Physical Location',mission.location_text],
  ['Mission Goal',mission.goal],
  ['Team Roles Needed',mission.roles_summary??'Not specified'],
  ['Start Date',mission.starts_on??'Not specified'],
  ['End Date',mission.ends_on??'Not specified']
 ];
 return <section className="space-y-3 rounded-2xl border border-line p-4" aria-label="Linked SDG Mission details">
  <h2 className="text-lg font-semibold text-ink">SDG Mission — {mission.title}</h2>
  <p className="text-xs text-muted">These values are shared with the mission and updated through Edit SDG Mission.</p>
  <div className="grid gap-3 sm:grid-cols-2">{details.map(([label,value])=><div key={label}><p className="text-xs text-muted">{label}</p><p className="whitespace-pre-wrap break-words text-sm text-ink">{value}</p></div>)}</div>
  <div className="grid gap-3 sm:grid-cols-2">
   <div><p className="flex items-center gap-1 text-xs text-muted">Budget <MissionFundingHelp kind="budget"/></p><p className="text-ink">{money(mission.budget_amount,mission.currency_code)}</p></div>
   <div><p className="flex items-center gap-1 text-xs text-muted">Funding Goal <MissionFundingHelp kind="funding"/></p><p className="text-gold">{money(mission.funding_goal_amount,mission.currency_code)}</p></div>
  </div>
  <p className="text-xs text-muted">Currency: {mission.currency_code}. Change shared mission details in Edit SDG Mission.</p>
 </section>;
}
