'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { answerProfileConnectionRequest } from '@/app/(app)/feed/profile-actions';

export function ConnectionRequestActions({actorId,actorA,actorB}:{actorId:string;actorA:string;actorB:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[finished,setFinished]=useState(false),[error,setError]=useState('');
 const respond=async(status:'accepted'|'declined')=>{
  if(busy)return;setBusy(true);setError('');
  try{
   const result=await answerProfileConnectionRequest({actorId,actorA,actorB,status});
   if(!result.ok)throw Error('Failed');
   setFinished(true);router.refresh();
  }catch{setError('Could not update request. Please try again.');}
  finally{setBusy(false);}
 };
 return <div className="space-y-2">{!finished&&<div className="flex gap-2">
  <button type="button" onClick={()=>respond('accepted')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-navy disabled:opacity-60"><Check size={16}/>Accept</button>
  <button type="button" onClick={()=>respond('declined')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-ink disabled:opacity-60"><X size={16}/>Decline</button>
 </div>}{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}</div>;
}
