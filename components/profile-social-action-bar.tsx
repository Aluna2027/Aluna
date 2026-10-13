'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, MessageCircle, UserPlus } from 'lucide-react';
import { answerProfileConnectionRequest, removeProfileConnection, sendProfileConnectionRequest, setProfileFollow } from '@/app/(app)/feed/profile-actions';

type Connection={actor_a:string;actor_b:string;requested_by:string;status:string};
export type ProfileRelationOption={id:string;name:string;following:boolean;connection:Connection|null};
type Patch={following?:boolean;connection?:Connection|null};
export function ProfileSocialActionBar({targetActorId,profilePath,options}:{targetActorId:string;profilePath:string;options:ProfileRelationOption[]}) {
 const router=useRouter(),menu=useRef<HTMLDetailsElement>(null);
 const [actorId,setActorId]=useState(options[0]?.id??'');
 const [patches,setPatches]=useState<Record<string,Patch>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const selected=options.find(o=>o.id===actorId)??options[0];
 if(!selected)return null;
 const patch=patches[selected.id]??{};
 const following=patch.following??selected.following;
 const connection=patch.connection===undefined?selected.connection:patch.connection;
 const update=(id:string,value:Patch)=>setPatches(p=>({...p,[id]:{...p[id],...value}}));
 const sync=()=>router.refresh();
 const follow=async()=>{
  if(busy)return;
  const id=selected.id,previous=following,next=!following;
  setBusy(true);setError('');update(id,{following:next});
  try {
   const result=await setProfileFollow({actorId:id,targetActorId,following:next});
   if(result.ok)sync();else{update(id,{following:previous});setError('Follow could not be updated. Please try again.');}
  }catch{update(id,{following:previous});setError('Follow could not be updated. Please try again.');}
  finally{setBusy(false);}
 };
 const connect=async()=>{
  if(busy)return;setBusy(true);setError('');
  const id=selected.id,[actor_a,actor_b]=[selected.id,targetActorId].sort();
  try{
   const result=await sendProfileConnectionRequest({actorId:id,targetActorId});
   if(result.ok){update(id,{connection:{actor_a,actor_b,requested_by:id,status:'pending'}});sync();}
   else setError('Connection request failed. Please try again.');
  }catch{setError('Connection request failed. Please try again.');}
  finally{setBusy(false);}
 };
 const respond=async(status:'accepted'|'declined')=>{
  if(busy||!connection)return;setBusy(true);setError('');
  try{
   const result=await answerProfileConnectionRequest({actorId:selected.id,actorA:connection.actor_a,actorB:connection.actor_b,status});
   if(result.ok){update(selected.id,{connection:{...connection,status}});sync();}
   else setError('Could not update connection request.');
  }catch{setError('Could not update connection request.');}
  finally{setBusy(false);}
 };
 const remove=async()=>{
  if(busy||!connection)return;
  if(!window.confirm('Remove this connection? You will still be able to Follow and Message each other.'))return;
  setBusy(true);setError('');
  try{
   const result=await removeProfileConnection({actorId:selected.id,targetActorId});
   if(result.ok){update(selected.id,{connection:null});menu.current?.removeAttribute('open');sync();}
   else setError('Could not remove connection. Please try again.');
  }catch{setError('Could not remove connection. Please try again.');}
  finally{setBusy(false);}
 };
 return <section aria-label="Profile actions" className="space-y-2 rounded-2xl border border-line bg-panel p-4 text-sm">
  <div className="flex flex-wrap items-center gap-3">
   {options.length>1&&<label className="flex items-center gap-2 text-muted">Act as<select aria-label="Act as" value={selected.id} onChange={e=>{setActorId(e.target.value);setError('');}} className="max-w-56 rounded-lg border border-line bg-panel-raised px-3 py-2 text-ink">{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
   {connection?.status==='accepted'
    ?<details ref={menu} className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line bg-panel-raised px-4 py-2 font-medium text-ink hover:bg-nav-active [&::-webkit-details-marker]:hidden"><CheckCircle2 size={17} className="text-turquoise"/> Connected <ChevronDown size={15}/></summary>
      <div className="absolute left-0 z-20 mt-2 min-w-52 rounded-xl border border-line bg-panel-raised p-2 shadow-xl">
       <Link href={`${profilePath}?tab=connections`} scroll={false} className="block rounded-lg px-3 py-2 text-ink hover:bg-nav-active">View connections</Link>
       <button type="button" disabled={busy} onClick={remove} className="w-full rounded-lg px-3 py-2 text-left text-red-300 hover:bg-nav-active disabled:opacity-60">Remove connection</button>
      </div>
     </details>
    :connection?.status==='pending'
     ?connection.requested_by===selected.id?<span className="rounded-lg border border-line px-4 py-2 text-muted">Request pending</span>
      :<div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>respond('accepted')} className="rounded-lg border border-gold px-4 py-2 text-gold disabled:opacity-60">Accept</button><button type="button" disabled={busy} onClick={()=>respond('declined')} className="rounded-lg border border-line px-4 py-2 text-muted disabled:opacity-60">Decline</button></div>
     :connection?.status==='declined'?<span className="rounded-lg border border-line px-4 py-2 text-muted">Request declined</span>
     :<button type="button" disabled={busy} onClick={connect} className="rounded-lg border border-line px-4 py-2 font-medium text-ink hover:bg-panel-raised disabled:opacity-60">Connect</button>}
   <button type="button" onClick={follow} disabled={busy} aria-pressed={following} title={following?'Unfollow this profile':'Follow this profile'} className="inline-flex items-center gap-2 rounded-lg border border-gold px-4 py-2 font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60">{following?<CheckCircle2 size={16}/>:<UserPlus size={16}/>} {following?'Following':'Follow'}</button>
   <Link href={`/messages?to=${targetActorId}`} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-navy hover:opacity-90"><MessageCircle size={16}/>Message</Link>
  </div>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
 </section>;
}
