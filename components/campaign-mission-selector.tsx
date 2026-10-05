'use client';

import { useState } from 'react';

type MissionChoice={id:string;title:string;location:string;sdgs:string[]};

export function CampaignMissionSelector({missions,lockedMissionId}:{missions:MissionChoice[];lockedMissionId?:string|null}){
 const initial=lockedMissionId??'';
 const [missionId,setMissionId]=useState(initial);
 const mission=missions.find(m=>m.id===missionId)??null;
 return <div className="space-y-5">
  <div className="block text-sm">SDGs:
   <div className="mt-2 min-h-[50px] rounded-xl border border-line bg-panel-raised p-3">
    {mission?.sdgs.length?mission.sdgs.map(label=><p key={label} className="text-ink">{label}</p>):<p className="text-muted">Select an SDG Mission to view its SDGs.</p>}
   </div>
  </div>
  {lockedMissionId
   ?<div className="block text-sm">SDG Mission
     <input type="hidden" name="mission_id" value={lockedMissionId}/>
     <div className="mt-2 rounded-xl border border-line bg-panel-raised p-3">
      <p className="font-semibold text-ink">{mission?.title}</p>
      <p className="mt-1 text-sm text-muted">{mission?.location}</p>
     </div>
    </div>
   :<label className="block text-sm">SDG Mission
     <select name="mission_id" required value={missionId} onChange={event=>setMissionId(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">
      <option value="" disabled>Select SDG mission</option>
      {missions.map(m=><option key={m.id} value={m.id}>{m.title} · {m.location}</option>)}
     </select>
    </label>}
 </div>;
}
