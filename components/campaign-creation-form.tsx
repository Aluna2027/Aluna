'use client';
import { useState } from 'react';
import { HandCoins,UsersRound,HandHeart,Wrench,Clock,Lightbulb,Box } from 'lucide-react';
import { CampaignMissionDetails,type CampaignMissionInfo } from '@/components/campaign-mission-details';
type Actor={id:string;name:string;kind:string};
const kinds=[
 {id:'join_team',label:'Join Team',Icon:UsersRound,color:'#FFC43D'},
 {id:'volunteer',label:'Volunteer',Icon:HandHeart,color:'#26E7D4'},
 {id:'contribute_skills',label:'Contribute Skills',Icon:Wrench,color:'#8A4DFF'},
 {id:'contribute_time',label:'Contribute Time',Icon:Clock,color:'#35F3FF'},
 {id:'provide_expertise',label:'Provide Expertise',Icon:Lightbulb,color:'#FF4FD8'},
 {id:'provide_resources',label:'Provide Resources',Icon:Box,color:'#6A7CFF'},
 {id:'fundraising',label:'Fundraising',Icon:HandCoins,color:'#FF4FD8'}
];
export function CampaignCreationForm({missions,actors,participations,lockedMissionId}:{missions:CampaignMissionInfo[];actors:Actor[];participations:{mission_id:string;actor_id:string;participation_kind:string}[];lockedMissionId?:string|null}){
 const [missionId,setMissionId]=useState(lockedMissionId??'');
 const [actorId,setActorId]=useState(actors[0]?.id??'');
 const [extras,setExtras]=useState<string[]>([]);
 const mission=missions.find(x=>x.id===missionId);
 const joined=participations.filter(p=>p.mission_id===missionId&&p.actor_id===actorId).map(p=>p.participation_kind);
 const originalCreator=mission?.created_by_actor_id===actorId;
 const checked=new Set(['fundraising',...joined,...extras]);
 const ready=Boolean(mission&&actorId&&mission.funding_goal_amount!==null&&mission.funding_goal_amount>0);
 return <div className="space-y-5">
  <label className="block text-sm">SDG Mission
   {lockedMissionId?<input type="text" readOnly value={mission?.title??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/>:
    <select name="mission_id" value={missionId} onChange={e=>{setMissionId(e.target.value);setExtras([])}} required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">Select SDG Mission</option>{missions.map(m=><option value={m.id} key={m.id}>{m.title}</option>)}</select>}
   {lockedMissionId&&<input type="hidden" name="mission_id" value={lockedMissionId}/>}
  </label>
  {mission&&<CampaignMissionDetails mission={mission}/>}
  <label className="block text-sm">Create as<select name="actor_id" required value={actorId} onChange={e=>{setActorId(e.target.value);setExtras([])}} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">{actors.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select></label>
  {mission&&<fieldset className="space-y-3 rounded-xl border border-line p-4">
   <legend className="px-2 text-sm font-semibold">Join Mission — Participation</legend>
   <p className="text-xs text-muted">{originalCreator?'As mission creator you are already authorized.':joined.length?'Your existing participation is retained. Fundraising is required for a campaign.':'Select participation types. Fundraising is required and the mission will be joined when your campaign is created.'}</p>
   <div className="grid grid-cols-2 gap-3">{kinds.map(({id,label,Icon,color})=><label key={id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel-raised p-3 text-sm" style={{borderColor:checked.has(id)?color:undefined}}>
    <Icon size={20} color={color}/><span className="min-w-0 flex-1">{label}</span>
    <input type="checkbox" name="participation_kind" value={id} checked={checked.has(id)} disabled={id==='fundraising'||joined.includes(id)} onChange={e=>setExtras(prev=>e.target.checked?[...prev,id]:prev.filter(x=>x!==id))} className="accent-gold"/>
    {joined.includes(id)&&id!=='fundraising'&&<input type="hidden" name="participation_kind" value={id}/>}
    {id==='fundraising'&&<input type="hidden" name="participation_kind" value="fundraising"/>}
   </label>)}</div>
  </fieldset>}
  <label className="block text-sm">Campaign Title<input name="title" required minLength={3} maxLength={180} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Campaign Story<textarea name="story" required minLength={10} maxLength={5000} rows={5} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <button type="submit" disabled={!ready} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">Create Campaign</button>
 </div>;
}
