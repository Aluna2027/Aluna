'use client';
import {useState} from 'react';
import {contributionTypes,resultKeys} from '@/lib/contributions';
type Actor={id:string;name:string;kind:string};
type Project={id:string;name:string;city_id:string|null;community_id?:string|null;location?:string};
export function PR43ContributionForm({actors,missions,communities,cityNames,initial}:{actors:Actor[];missions:Project[];communities:Project[];cityNames:Record<string,string>;initial:{actor?:string;mission?:string;community?:string}}){
 const [actor,setActor]=useState(initial.actor&&actors.some(a=>a.id===initial.actor)?initial.actor:actors[0]?.id??'');
 const [mission,setMission]=useState(initial.mission??'');
 const [community,setCommunity]=useState(initial.community??'');
 const [types,setTypes]=useState<string[]>(['data']);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const m=missions.find(x=>x.id===mission),c=communities.find(x=>x.id===community);
 const city=m?.city_id??c?.city_id??null;
 const possibleMissions=missions.filter(x=>!community||x.community_id===community);
 const possibleCommunities=communities.filter(x=>!mission||m?.community_id===x.id);
 const isMissionOwner=m&&actor&&m.community_id!==undefined; // owner eligibility enforced server-side
 const fields='mt-1 w-full rounded-xl border border-line bg-panel-raised p-3';
 const today=new Date().toISOString().slice(0,10);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!actor||(!mission&&!community)||!types.length)return;
  setBusy(true);setError('');
  const fd=new FormData(e.currentTarget);
  try{
   const items=types.map(type=>{
    const title=String(fd.get(type+'_title')||'').trim(),description=String(fd.get(type+'_description')||'').trim(),date=String(fd.get(type+'_date')||today);
    const details:Record<string,string>={},metrics:{key:string;quantity:number;unit:string;reference?:string;indicator?:string;sdgs?:number[]}[]=[];
    for(const k of ['hours','skill','completion_status','operational','reference','indicator','period','currency']){const v=String(fd.get(type+'_'+k)||'').trim();if(v)details[k]=v;}
    if(type==='data'){
     for(const metric of resultKeys){
      const v=String(fd.get('data_'+metric.key)||'').trim();
      if(v!=='')metrics.push({key:metric.key,quantity:Number(v),unit:metric.unit,reference:String(fd.get('data_reference')||'').trim()||undefined,indicator:metric.key==='sdg_metrics'?String(fd.get('data_indicator')||''):undefined,sdgs:metric.key==='sdg_metrics'?fd.getAll('data_sdg').map(Number):undefined});
     }
    } else if(type==='time')metrics.push({key:'volunteer_hours',quantity:Number(fd.get('time_hours')),unit:'hours'});
    else if(type==='skills')metrics.push({key:'skills_contributed',quantity:1,unit:'contributions'});
    else if(type==='complete_sdg_mission')metrics.push({key:'mission_completed',quantity:1,unit:'mission'});
    else if(type==='complete_wifi_community')metrics.push({key:'wifi_completed',quantity:1,unit:'community'});
    else metrics.push({key:'community_data',quantity:1,unit:'contribution'});
    return {type,title,description,date,details,metrics};
   });
   const res=await fetch('/api/pr43/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,mission:mission||null,community:community||null,items})});
   const result=await res.json();
   if(!res.ok)throw Error(result.error||'Could not record the contribution.');
   const inputs=types.flatMap(type=>Array.from(fd.getAll(type+'_files')).filter(x=>x instanceof File && x.size>0).map(x=>({type,file:x as File})));
   for(const entry of inputs){const media=new FormData();media.set('submission',result.submission);media.set('type',entry.type);media.set('file',entry.file);const uploaded=await fetch('/api/pr43/evidence',{method:'POST',body:media});if(!uploaded.ok)throw Error('Contribution recorded, but one attachment could not be uploaded. You can add evidence later.');}
   window.location.assign('/contributions?status=created');
  }catch(e){setError(e instanceof Error?e.message:'Unexpected error');setBusy(false);}
 }
 return <form onSubmit={submit} className="max-w-3xl space-y-5">
  {error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">{error}</p>}
  <label className="block text-sm">Wi-Fi Mesh Community<select className={fields} value={community} onChange={e=>{setCommunity(e.target.value);if(e.target.value&&m?.community_id!==e.target.value)setMission('')}}><option value="">No community selected</option>{possibleCommunities.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
  <label className="block text-sm">SDG Mission<select className={fields} value={mission} onChange={e=>{setMission(e.target.value);if(e.target.value&&c?.id!==missions.find(x=>x.id===e.target.value)?.community_id)setCommunity('')}}><option value="">No mission selected</option>{possibleMissions.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
  <label className="block text-sm">City<input className={fields} readOnly value={city?cityNames[city]??'Linked project city':m?.location??'Determined from selected project'} /></label>
  <p className="text-xs text-muted">Select a Wi-Fi Mesh Community and/or SDG Mission. When both are selected they must belong to the same project.</p>
  <label className="block text-sm">Contribute as *<select required className={fields} value={actor} onChange={e=>setActor(e.target.value)}>{actors.map(v=><option key={v.id} value={v.id}>{v.name} · {v.kind}</option>)}</select></label>
  <fieldset className="space-y-3"><legend className="font-semibold text-ink">Contribution types * (select multiple)</legend><div className="grid gap-3 sm:grid-cols-2">{contributionTypes.map(t=><label key={t.value} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm"><input type="checkbox" checked={types.includes(t.value)} onChange={e=>setTypes(old=>e.target.checked?[...old,t.value]:old.filter(x=>x!==t.value))}/>{t.label}</label>)}</div></fieldset>
  {types.map(type=><section key={type} className="space-y-3 rounded-2xl border border-line bg-panel p-4"><h3 className="font-semibold text-gold">{contributionTypes.find(t=>t.value===type)?.label}</h3>
   <label className="block text-sm">Title *<input className={fields} name={type+'_title'} required minLength={3} maxLength={160}/></label>
   <label className="block text-sm">Description *<textarea className={fields} name={type+'_description'} required minLength={10} maxLength={3000} rows={3}/></label>
   <label className="block text-sm">Date contribution *<input type="date" className={fields} name={type+'_date'} defaultValue={today} required/></label>
   {type==='data'&&<><p className="text-sm text-muted">Only enter results actually measured. Independent verification is required before they affect Impact.</p><div className="grid gap-3 sm:grid-cols-2">{resultKeys.map(metric=><label key={metric.key} className="block text-sm">{metric.label}<input type="number" min="0" step={metric.key==='money_invested'?'0.01':'1'} name={'data_'+metric.key} className={fields} placeholder="Not measured"/></label>)}</div>
    <label className="block text-sm">Source / reference<input name="data_reference" className={fields} placeholder="Unique measurement or installation reference"/></label>
    <label className="block text-sm">SDG indicator<input name="data_indicator" className={fields} placeholder="For example: indicator 4.4.1"/></label>
    <fieldset><legend className="text-sm">Related SDGs (select multiple)</legend><div className="grid grid-cols-3 gap-2">{Array.from({length:17},(_,i)=>i+1).map(n=><label key={n} className="text-sm"><input name="data_sdg" type="checkbox" value={n} className="mr-2"/>SDG {n}</label>)}</div></fieldset>
   </>}
   {type==='time'&&<label className="block text-sm">Volunteer Hours *<input className={fields} type="number" min="0.01" max="100000" step="0.25" name="time_hours" required/></label>}
   {type==='skills'&&<label className="block text-sm">Skill performed *<input className={fields} name="skills_skill" required/></label>}
   {type==='complete_sdg_mission'||type==='complete_wifi_community'?<><p className="text-sm">Only the project creator or steward can submit project completion.</p><fieldset className="space-y-2"><legend className="text-sm">Were the objectives achieved? *</legend>{['all','partial','none'].map(x=><label key={x} className="block text-sm"><input type="radio" name={type+'_completion_status'} value={x} required className="mr-2"/>{x==='all'?'All objectives achieved':x==='partial'?'Partially achieved':'Not achieved'}</label>)}</fieldset>{type==='complete_wifi_community'&&<label className="block text-sm">Network operational?<select name={type+'_operational'} className={fields}><option value="yes">Yes</option><option value="no">Not yet</option></select></label>}</>:null}
   <label className="block text-sm">Photos, videos and files (multiple)<input type="file" name={type+'_files'} multiple accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx" className={fields}/></label>
  </section>)}
  <button disabled={busy||!actor||(!mission&&!community)||!types.length} className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy disabled:opacity-50">{busy?'Recording…':'Record Contribution'}</button>
 </form>;
}
