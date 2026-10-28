'use client';

import { useState, type CSSProperties } from 'react';
import {
  Box, Check, CircleCheck, Clock, HandHeart, Lightbulb, HandCoins,
  UserRoundPlus, UsersRound, Wrench,
} from 'lucide-react';
import { participationOptions } from '@/lib/missions';
import { leaveMissionFromDirectory, saveMissionParticipationFromDirectory } from '@/app/(app)/missions/actions';

type ActorOption={id:string;name:string;kind:string};
type Participation={actor_id:string;participation_kind:string};

const visuals=[
  {icon:UsersRound,color:'#FFC43D',short:'Team'},
  {icon:HandHeart,color:'#26E7D4',short:'Volunteer'},
  {icon:Wrench,color:'#8A4DFF',short:'Skills'},
  {icon:Clock,color:'#35F3FF',short:'Time'},
  {icon:Lightbulb,color:'#FF4FD8',short:'Expertise'},
  {icon:Box,color:'#6A7CFF',short:'Resources'},
  {icon:HandCoins,color:'#FF4FD8',short:'Fundraising'},
] as const;

export function MissionParticipationIcons({kinds,large=false}:{kinds:string[];large?:boolean}){
 return <div className="flex flex-wrap items-center gap-2" aria-label="Selected mission participation roles">
  {participationOptions.map((option,index)=>{
   if(!kinds.includes(option.value))return null;
   const visual=visuals[index],Icon=visual.icon;
   return <span key={option.value} title={option.label} aria-label={option.label} className={large
     ?'flex size-14 shrink-0 items-center justify-center rounded-xl border bg-panel-raised sm:size-16'
     :'flex size-10 shrink-0 items-center justify-center rounded-lg border bg-panel-raised'}
     style={{borderColor:visual.color}}>
    <Icon aria-hidden="true" size={large?29:22} color={visual.color}/>
   </span>;
  })}
 </div>;
}

export function MissionParticipationControl({
  missionId,actors,participations,variant='directory',
}:{
  missionId:string;
  actors:ActorOption[];
  participations:Participation[];
  variant?:'directory'|'detail';
}){
  const kindsFor=(id:string)=>participations.filter(p=>p.actor_id===id).map(p=>p.participation_kind);
  const firstJoined=actors.find(actor=>kindsFor(actor.id).length>0);
  const [actorId,setActorId]=useState(firstJoined?.id??actors[0]?.id??'');
  const [chosen,setChosen]=useState<string[]>(()=>kindsFor(firstJoined?.id??actors[0]?.id??''));
  const [editing,setEditing]=useState(false);
  const [confirmLeave,setConfirmLeave]=useState(false);
  if(!actors.length)return null;

  const joinedKinds=kindsFor(actorId);
  const joined=joinedKinds.length>0;
  const actor=actors.find(item=>item.id===actorId)??actors[0];

  function changeActor(next:string){
    setActorId(next);
    setChosen(kindsFor(next));
    setEditing(false);
    setConfirmLeave(false);
  }
  function toggle(value:string){
    setChosen(current=>current.includes(value)?current.filter(x=>x!==value):[...current,value]);
  }

  return <div className="space-y-3">
   {actors.length>1&&<label className="block text-sm text-muted">
     Participating as
     <select name="card_actor_selector" aria-label="View participation as" value={actorId} onChange={event=>changeActor(event.target.value)} className="mt-2 block w-full rounded-xl border border-line bg-panel-raised p-3 text-ink">
      {actors.map(item=><option key={item.id} value={item.id}>{item.name} · {item.kind}</option>)}
     </select>
   </label>}
   {joined&&variant==='directory'&&<div className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your participation</p>
    <div className="flex flex-wrap gap-3">
     {participationOptions.map((opt,i)=>{
       if(!joinedKinds.includes(opt.value))return null;
       const visual=visuals[i];const Icon=visual.icon;
       return <span key={opt.value} className="flex min-w-[82px] flex-col items-center gap-2 rounded-xl border bg-panel-raised px-3 py-3" style={{borderColor:visual.color}}>
        <Icon aria-hidden="true" size={25} color={visual.color}/>
        <span className="text-xs font-medium text-ink">{visual.short}</span>
       </span>;
     })}
    </div>
   </div>}
   {variant==='detail'?<>
    <div className="flex flex-wrap items-center gap-3">
     {joined?<span role="status" className="flex min-h-[65px] items-center justify-center gap-3 rounded-xl border border-[#26E7D4] bg-[#122C2D] px-5 text-lg font-semibold text-[#26E7D4]"><CircleCheck aria-hidden="true" size={22}/>Joined</span>
     :<button type="button" onClick={()=>{setEditing(open=>!open);setConfirmLeave(false);setChosen(joinedKinds)}} aria-expanded={editing} className="flex min-h-[65px] items-center justify-center gap-3 rounded-xl bg-gold px-5 text-lg font-semibold text-navy hover:bg-gold-soft"><UserRoundPlus aria-hidden="true" size={22}/>Join Mission</button>}
     {joined&&<MissionParticipationIcons kinds={joinedKinds} large/>}
    </div>
    {joined&&<div className="flex flex-wrap items-center gap-5 text-sm">
     <button type="button" className="inline-flex items-center gap-2 text-gold hover:underline" onClick={()=>{setEditing(open=>!open);setConfirmLeave(false);setChosen(joinedKinds)}} aria-expanded={editing}>Edit Participation</button>
     <button type="button" className="text-[#E49BA3] hover:underline" onClick={()=>{setConfirmLeave(open=>!open);setEditing(false)}} aria-expanded={confirmLeave}>Leave Mission</button>
    </div>}
   </>:<button type="button" onClick={()=>{setEditing(open=>!open);setConfirmLeave(false);setChosen(joinedKinds)}} aria-expanded={editing} aria-label={joined?'Manage participation for '+actor.name:'Join mission as '+actor.name} className={joined
     ?'flex min-h-[65px] w-full items-center justify-center gap-3 rounded-xl border border-[#26E7D4] bg-[#122C2D] px-4 text-lg font-semibold text-[#26E7D4] hover:bg-[#19383A]'
     :'flex min-h-[65px] w-full items-center justify-center gap-3 rounded-xl bg-gold px-4 text-lg font-semibold text-navy hover:bg-gold-soft'}>
     {joined?<CircleCheck aria-hidden="true" size={22}/>:<UserRoundPlus aria-hidden="true" size={22}/>}
     {joined?'Joined':'Join Mission'}
   </button>}
   {editing&&<div className="rounded-2xl border border-line bg-navy p-4">
    <h3 className="text-xl font-bold normal-case text-ink [font-stretch:normal]">{joined?'Manage Participation':'Join SDG Mission'}</h3>
    <p className="mt-2 text-sm text-muted">Choose one or more ways to participate.</p>
    <form action={saveMissionParticipationFromDirectory} className="mt-5 space-y-4">
     <input type="hidden" name="mission_id" value={missionId}/>
     <input type="hidden" name="actor_id" value={actorId}/>
     {variant==='detail'&&<input type="hidden" name="return_to" value={`/missions/${missionId}?tab=overview`}/>}
     <fieldset>
      <legend className="sr-only">Participation types</legend>
      <div className="grid grid-cols-2 gap-3">
       {participationOptions.map((opt,i)=>{
        const visual=visuals[i];const Icon=visual.icon;
        return <label key={opt.value} className="flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-line bg-panel-raised p-3 has-[:checked]:border-[var(--participation-color)] has-[:checked]:bg-[#1B2331]" style={{'--participation-color':visual.color} as CSSProperties}>
         <span className="flex items-start justify-between gap-2">
          <Icon aria-hidden="true" size={24} color={visual.color}/>
          <input type="checkbox" name="participation_kind" value={opt.value} checked={chosen.includes(opt.value)} onChange={()=>toggle(opt.value)} aria-label={opt.label} className="size-4 accent-gold"/>
         </span>
         <span className="text-sm font-semibold text-ink">{opt.label}</span>
        </label>;
       })}
      </div>
     </fieldset>
     <p aria-live="polite" className="text-sm text-muted">{chosen.length} participation {chosen.length===1?'type':'types'} selected</p>
     <button type="submit" disabled={!chosen.length} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-gold px-3 text-base font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-50">
      <Check aria-hidden="true" size={20}/>{joined?'Save Participation':'Confirm Participation'}
     </button>
    </form>
   </div>}
   {joined&&variant==='directory'&&<div className="text-center">
    <button type="button" onClick={()=>{setConfirmLeave(open=>!open);setEditing(false)}} aria-expanded={confirmLeave} className="text-sm text-muted underline underline-offset-4 hover:text-ink">Leave Mission</button>
   </div>}
   {joined&&confirmLeave&&<div role="group" aria-label="Confirm leaving mission" className="space-y-4 rounded-2xl border border-line bg-navy p-4">
    <h3 className="text-lg font-bold normal-case text-ink [font-stretch:normal]">Unjoin Mission</h3>
    <p className="text-sm text-muted">Are you sure you want to leave this mission as {actor.name}? Your current participation types will be removed.</p>
    <ul className="space-y-2">
     {participationOptions.map((opt,i)=>{
      if(!joinedKinds.includes(opt.value))return null;
      const Icon=visuals[i].icon;
      return <li key={opt.value} className="flex items-center gap-2 text-sm text-ink"><Icon color={visuals[i].color} size={19} aria-hidden="true"/>{opt.label}</li>;
     })}
    </ul>
    <p className="text-xs text-muted">You can join again later.</p>
    <form action={leaveMissionFromDirectory} className="flex gap-3">
     <input type="hidden" name="mission_id" value={missionId}/>
     <input type="hidden" name="actor_id" value={actorId}/>
     {variant==='detail'&&<input type="hidden" name="return_to" value={`/missions/${missionId}?tab=overview`}/>}
     <button type="button" onClick={()=>setConfirmLeave(false)} className="min-h-12 flex-1 rounded-xl border border-line text-ink">Cancel</button>
     <button type="submit" className="min-h-12 flex-1 rounded-xl bg-gold px-3 font-semibold text-navy">Unjoin Mission</button>
    </form>
   </div>}
  </div>;
}
