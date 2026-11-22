'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {conversationControl} from '@/app/(app)/messages/actions';
export function ConversationMenu({conversationId,actorId,blocked}:{conversationId:string;actorId:string;blocked:boolean}){
 const router=useRouter();const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(action:'block'|'unblock'|'hide'){
  setBusy(true);setError('');let result;
  try{result=await conversationControl(conversationId,actorId,action);}catch{setBusy(false);setError('Could not update this conversation. Please try again.');return;}setBusy(false);
  if(!result.ok){setError('Could not update this conversation. Please try again.');return;}
  setConfirm(false);if(action==='hide')router.replace('/messages');router.refresh();
 }
 return <div className="relative"><details><summary aria-label="Conversation actions" className="cursor-pointer list-none rounded-lg px-3 py-2 text-gold">⋯</summary><div className="absolute right-0 z-20 min-w-48 rounded-xl border border-line bg-panel p-2 shadow-xl"><button disabled={busy} onClick={()=>act(blocked?'unblock':'block')} className="block w-full rounded-lg p-2 text-left hover:bg-panel-raised">{blocked?'Unblock user':'Block user'}</button><button disabled={busy} onClick={()=>setConfirm(true)} className="block w-full rounded-lg p-2 text-left text-red-300 hover:bg-panel-raised">Delete conversation</button></div></details>
 {confirm&&<div role="dialog" aria-modal="true" aria-label="Delete conversation" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="max-w-md rounded-2xl border border-line bg-panel p-6"><h3 className="text-xl text-gold">Delete conversation?</h3><p className="my-4 text-sm text-muted">This hides the conversation only for you. The other participant keeps the history. A new message will restore it.</p><div className="flex gap-4"><button disabled={busy} onClick={()=>act('hide')} className="text-red-300">Delete conversation</button><button onClick={()=>setConfirm(false)}>Cancel</button></div></div></div>}
 {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}</div>;
}
