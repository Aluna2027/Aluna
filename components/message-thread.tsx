'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendMessageInline } from '@/app/(app)/messages/actions';

export type ChatMessage={id:string;sender_actor_id:string;body:string|null;created_at:string;media_type:string|null;media_url:string|null};
export function MessageThread({initialMessages,conversationId,recipientId,recipientName,senders,senderOptions}:{initialMessages:ChatMessage[];conversationId?:string;recipientId:string;recipientName:string;senders:{id:string;name:string}[];senderOptions:{id:string;name:string}[]}){
 const router=useRouter();
 const [messages,setMessages]=useState(initialMessages);
 const [body,setBody]=useState(''),[sender,setSender]=useState(senderOptions[0]?.id??'');
 const [file,setFile]=useState<File|null>(null),[sending,setSending]=useState(false),[error,setError]=useState('');
 const [threadId,setThreadId]=useState(conversationId);
 const end=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  setMessages(old=>{const merged=new Map([...old,...initialMessages].map(m=>[m.id,m]));return [...merged.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at));});
 },[initialMessages]);
 useEffect(()=>{if(conversationId)setThreadId(conversationId);},[conversationId]);
 const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(sending||(!body.trim()&&!file))return;
  const text=body.trim(),currentFile=file,actorId=sender;
  const pendingId=`pending-${Date.now()}`;
  const draft:ChatMessage={id:pendingId,sender_actor_id:actorId,body:text||null,created_at:new Date().toISOString(),media_type:currentFile?(currentFile.type.startsWith('image/')?'image':'video'):null,media_url:null};
  setMessages(old=>[...old,draft]);setBody('');setFile(null);if(fileInput.current)fileInput.current.value='';
  setSending(true);setError('');
  try{
   const form=new FormData();
   form.set('body',text);form.set('sender_actor_id',actorId);form.set('recipient_actor_id',recipientId);
   if(threadId)form.set('conversation_id',threadId);
   if(currentFile)form.set('media',currentFile);
   const result=await sendMessageInline(form);
   if(!result.ok||!result.message)throw new Error(result.error||'Message could not be sent.');
   setThreadId(result.conversationId);
   setMessages(old=>old.map(message=>message.id===pendingId?{...result.message!,media_url:result.message!.media_url??null}:message));
   if(result.conversationId&&!threadId)router.replace(`/messages?conversation=${result.conversationId}`,{scroll:false});
   else router.refresh();
  }catch(e){
   setMessages(old=>old.filter(m=>m.id!==pendingId));setBody(text);setFile(currentFile);
   setError(e instanceof Error?e.message:'Message could not be sent.');
  }finally{setSending(false);}
 };
 return <div className="space-y-4">
  <div className="max-h-[500px] min-h-48 space-y-4 overflow-y-auto" aria-live="polite">
   {messages.map(m=><div key={m.id} className="rounded-xl bg-panel-raised p-3">
    <p className="text-xs text-gold">{senders.find(a=>a.id===m.sender_actor_id)?.name||'Member'} · {m.id.startsWith('pending-')?'Sending…':new Date(m.created_at).toLocaleString('en')}</p>
    {m.body&&<p className="mt-2 whitespace-pre-wrap break-words">{m.body}</p>}
    {m.media_url&&m.media_type==='image'&&<img src={m.media_url} alt="Attached image" className="mt-3 max-h-96 w-full rounded-xl object-cover"/>}
    {m.media_url&&m.media_type==='video'&&<video src={m.media_url} controls preload="metadata" className="mt-3 max-h-96 w-full rounded-xl"/>}
    {m.id.startsWith('pending-')&&m.media_type&&<p className="text-xs text-muted">Uploading attachment…</p>}
   </div>)}
   <div ref={end}/>
  </div>
  <form onSubmit={submit} className="space-y-3">
   <textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} rows={3} placeholder={`Write a private message to ${recipientName}…`} className="w-full rounded-xl border border-line bg-panel-raised p-3 text-ink"/>
   <label className="block text-sm text-muted">Upload photo or video
    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>setFile(e.target.files?.[0]??null)} className="mt-2 block w-full rounded-xl border border-line bg-panel-raised p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-navy"/>
   </label>
   <div className="flex flex-wrap gap-3">
    {senderOptions.length>1&&<select value={sender} onChange={e=>setSender(e.target.value)} aria-label="Send as" className="rounded-lg border border-line bg-panel-raised p-2">{senderOptions.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>}
    <button type="submit" disabled={sending||(!body.trim()&&!file)} className="rounded-lg bg-gold px-5 py-2 font-semibold text-navy disabled:opacity-60">{sending?'Sending…':'Send'}</button>
   </div>
   {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  </form>
 </div>;
}
