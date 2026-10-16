'use client';
import {useState} from 'react';
import {CalendarDays, Clock3, X} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {allowedDocuments} from '@/components/composer-tools';
import type {Actor} from '@/lib/social';

type Item={id:string;actor_id:string;body:string;scheduled_for:string;visibility:string;status:string};
type Props={actors:Actor[];actorId:string;body:string;file:File|null;visibility:string;communityId?:string;missionId?:string;onSuccess:()=>void};
const pad=(n:number)=>String(n).padStart(2,'0');
function localValues(when:Date){return {day:when.getFullYear()+'-'+pad(when.getMonth()+1)+'-'+pad(when.getDate()),time:pad(when.getHours())+':'+pad(when.getMinutes())};}
function futureDate(day:string,time:string){const date=new Date(day+'T'+time+':00');return Number.isFinite(date.getTime())&&date.getTime()>Date.now()+30000&&date.getTime()<Date.now()+365*86400000?date:null;}
export function PostScheduler({actors,actorId,body,file,visibility,communityId,missionId,onSuccess}:Props){
 const initial=localValues(new Date(Date.now()+3600000));
 const [panel,setPanel]=useState<'none'|'schedule'|'list'>('none');
 const [day,setDay]=useState(initial.day),[time,setTime]=useState(initial.time);
 const [rows,setRows]=useState<Item[]>([]),[editing,setEditing]=useState<string|null>(null);
 const [draft,setDraft]=useState(''),[editDay,setEditDay]=useState(''),[editTime,setEditTime]=useState(''),[editVisibility,setEditVisibility]=useState('public');
 const [working,setWorking]=useState(false),[error,setError]=useState('');
 async function load(){
  setError('');setPanel('list');
  const {data,error}=await createClient().from('scheduled_posts').select('id,actor_id,body,scheduled_for,visibility,status').in('actor_id',actors.map(x=>x.id)).in('status',['pending','failed']).order('scheduled_for',{ascending:true}).limit(100);
  if(error)setError('Unable to load scheduled posts.');setRows((data??[]) as Item[]);
 }
 async function schedule(){
  setError('');const when=futureDate(day,time);
  if(!when){setError('Select a future date (at least 30 seconds away, within one year).');return;}
  if(!body.trim()||body.trim().length>5000||!actors.some(a=>a.id===actorId)){setError('Enter a post and choose your posting profile.');return;}
  if(file&&(file.size>50*1024*1024||!(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'].includes(file.type)||allowedDocuments.has(file.type)))){setError('Unsupported attachment or file larger than 50 MB.');return;}
  setWorking(true);let id:string|null=null;
  try{
   const client=createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw Error('Please log in.');
   const {data,error}=await client.from('scheduled_posts').insert({actor_id:actorId,body:body.trim(),visibility:communityId||missionId?'public':visibility,community_id:communityId||null,mission_id:missionId||null,scheduled_for:when.toISOString()}).select('id').single();
   if(error||!data)throw Error('Could not create scheduled post.');id=data.id;
   if(file){
    const type=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':'document';
    const name=file.name.replace(/[^a-z0-9._-]/gi,'_').slice(-96)||'attachment';
    const path=user.id+'/'+id+'/'+crypto.randomUUID()+'-'+name;
    const uploaded=await client.storage.from('post-media').upload(path,file,{contentType:file.type,upsert:false});
    if(uploaded.error)throw Error('Could not upload attachment.');
    const linked=await client.from('scheduled_posts').update({media_path:path,media_type:type}).eq('id',id).eq('status','draft');
    if(linked.error)throw Error('Could not link attachment.');
   }
   const activated=await client.rpc('activate_scheduled_post',{p_id:id});
   if(activated.error)throw Error('Could not activate post.');
   onSuccess();setPanel('none');
  }catch(e){setError(e instanceof Error?e.message:'Scheduling failed.');}
  finally{setWorking(false);}
 }
 function edit(row:Item){const v=localValues(new Date(row.scheduled_for));setEditing(row.id);setDraft(row.body);setEditDay(v.day);setEditTime(v.time);setEditVisibility(row.visibility);setError('');}
 async function save(){
  const when=futureDate(editDay,editTime);
  if(!when||!draft.trim()){setError('Enter text and a valid future date.');return;}
  setWorking(true);
  const r=await createClient().rpc('edit_scheduled_post',{p_id:editing,p_body:draft,p_scheduled_for:when.toISOString(),p_visibility:editVisibility});
  setWorking(false);
  if(r.error){setError('Could not edit. This post may have published.');return;}
  setEditing(null);await load();
 }
 async function cancel(id:string){
  setWorking(true);
  const r=await createClient().rpc('cancel_scheduled_post',{p_id:id});
  setWorking(false);
  if(r.error){setError('Unable to cancel; this post may already have published.');return;}
  await load();
 }
 return <>
  <button type="button" aria-label="Schedule post" aria-expanded={panel==='schedule'} title="Schedule post" onClick={()=>{setPanel(panel==='schedule'?'none':'schedule');setError('');}} className="rounded-lg p-2 text-[#FFC43D] hover:bg-panel hover:drop-shadow-[0_0_8px_#FFC43D]"><CalendarDays size={19}/></button>
  {panel!=='none'&&<div role="dialog" aria-label={panel==='schedule'?'Schedule post':'Scheduled posts'} className="absolute right-0 top-full z-40 mt-2 w-[min(380px,calc(100vw-32px))] max-h-[75vh] overflow-y-auto rounded-xl border border-line bg-[#11151F] p-4 text-ink shadow-2xl">
   <div className="mb-3 flex items-center justify-between"><strong>{panel==='schedule'?'Schedule Post':'Scheduled Posts'}</strong><button type="button" aria-label="Close" onClick={()=>setPanel('none')}><X size={18}/></button></div>
   {panel==='schedule'?<>
    <label className="mb-3 block text-xs text-muted">Month / Day / Year <span className="flex items-center gap-2"><input aria-label="Publication date" type="date" value={day} onChange={e=>setDay(e.target.value)} className="mt-1 min-w-0 flex-1 rounded-lg border border-line bg-panel-raised p-2 text-ink"/><CalendarDays size={20} className="text-gold"/></span></label>
    <label className="mb-3 block text-xs text-muted">Hours : Minutes <span className="flex items-center gap-2"><input aria-label="Publication time" type="time" value={time} onChange={e=>setTime(e.target.value)} className="mt-1 min-w-0 flex-1 rounded-lg border border-line bg-panel-raised p-2 text-ink"/><Clock3 size={20} className="text-[#26E7D4]"/></span></label>
    <p className="mb-3 text-xs text-muted">Time is based on your device’s time zone.</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={load} className="text-sm text-[#26E7D4]">Scheduled Posts →</button><button type="button" onClick={schedule} disabled={working||!body.trim()} className="rounded-lg bg-gold px-3 py-2 font-semibold text-navy disabled:opacity-40">{working?'Saving…':'Schedule'}</button></div>
   </>:<>
    {!rows.length&&<p className="text-sm text-muted">No upcoming posts.</p>}
    <div className="space-y-3">{rows.map(item=><div key={item.id} className="rounded-lg border border-line bg-panel-raised p-3 text-sm">
      {editing===item.id?<div className="space-y-2">
       <textarea aria-label="Edit scheduled text" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={5000} rows={3} className="w-full rounded-md border border-line bg-panel p-2 text-ink"/>
       <input aria-label="Edit date" type="date" value={editDay} onChange={e=>setEditDay(e.target.value)} className="w-full rounded-md border border-line bg-panel p-2 text-ink"/>
       <input aria-label="Edit time" type="time" value={editTime} onChange={e=>setEditTime(e.target.value)} className="w-full rounded-md border border-line bg-panel p-2 text-ink"/>
       <select aria-label="Audience" value={editVisibility} onChange={e=>setEditVisibility(e.target.value)} className="w-full rounded-md border border-line bg-panel p-2 text-ink"><option value="public">Everyone</option><option value="followers">Followers</option></select>
       <div className="flex gap-3"><button type="button" disabled={working} onClick={save} className="text-gold">Save changes</button><button type="button" onClick={()=>setEditing(null)}>Back</button></div>
      </div>:<>
       <p className="line-clamp-3 whitespace-pre-wrap">{item.body}</p>
       <p className="mt-2 text-xs text-muted">{new Date(item.scheduled_for).toLocaleString()} · {actors.find(a=>a.id===item.actor_id)?.name??'Account'} · {item.status}</p>
       <div className="mt-2 flex gap-4">{item.status==='pending'&&<button type="button" onClick={()=>edit(item)} className="text-gold">Edit</button>}<button type="button" disabled={working} onClick={()=>cancel(item.id)} className="text-red-300">Cancel</button></div>
      </>}
    </div>)}</div>
    <button type="button" onClick={()=>setPanel('schedule')} className="mt-3 text-xs text-[#26E7D4]">← Back to Schedule</button>
   </>}
   {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
  </div>}
 </>;
}
