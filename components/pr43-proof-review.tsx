'use client';
import {useMemo,useState} from 'react';
type Actor={id:string;name:string;kind:string};
type Project={id:string;name:string};
type Result={id:string;metric_key:string;quantity:number;unit:string;verification_level:number;verified_quantity:number|null};
type Item={id:string;title:string;description:string;details:Record<string,string>|null;contribution_type:string;contributed_on:string;mission_id:string|null;community_id:string|null;actor_id:string;pr43_contribution_results:Result[];pr43_contribution_files:{id:string;filename:string;storage_path:string;url?:string|null}[]};
const labels:Record<string,string>={people_connected:'People Connected',nodes_installed:'Wi-Fi Nodes Installed',local_owners:'Local Owners',money_invested:'Money Invested',volunteer_hours:'Volunteer Hours',skills_contributed:'Skills Contributed',sdg_metrics:'SDG Metrics',community_data:'Community Data',mission_completed:'Missions Completed',wifi_completed:'Community implementation completed'};
export function PR43ProofReview({actors,missions,communities,items,initial}:{actors:Actor[];missions:Project[];communities:Project[];items:Item[];initial:{mission?:string;community?:string;contribution?:string}}){
 const [actor,setActor]=useState(actors[0]?.id??'');
 const [mission,setMission]=useState(initial.mission??'');
 const [community,setCommunity]=useState(initial.community??'');
 const [pending,setPending]=useState<string|null>(null);
 const [resultMessages,setResultMessages]=useState<Record<string,{kind:'success'|'error';text:string}>>({});
 const [completed,setCompleted]=useState<Record<string,boolean>>({});
 const [uploadedKeys,setUploadedKeys]=useState<Record<string,string[]>>({});
 const [query,setQuery]=useState('');
 const [verified,setVerified]=useState<Record<string,boolean>>({});
 const [values,setValues]=useState<Record<string,string>>({});
 const [comments,setComments]=useState<Record<string,string>>({});
 const [uploads,setUploads]=useState<Record<string,File[]>>({});
 const [levels,setLevels]=useState<Record<string,number>>({});
 const visible=useMemo(()=>items.filter(i=>i.pr43_contribution_results.length>0&&i.pr43_contribution_results.some(r=>r.verification_level<4)&&(initial.contribution===i.id||(!initial.contribution&&(mission?i.mission_id===mission:true)&&(community?i.community_id===community:true)&&Boolean(mission||community)))&&(!query||[i.title,i.description,i.contribution_type].join(' ').toLowerCase().includes(query.toLowerCase()))),[items,mission,community,initial.contribution,query]);
 const input='mt-1 w-full rounded-xl border border-line bg-panel-raised p-3';
 async function review(result:Result,contributionId:string){
  if(!actor||!verified[result.id]||pending!==null||completed[result.id])return;
  setResultMessages(old=>{const next={...old};delete next[result.id];return next;});
  setPending(result.id);
  try{
   // Evidence already uploaded during a failed review should not be uploaded again on retry.
   const uploaded=new Set(uploadedKeys[result.id]??[]);
   for(const file of uploads[result.id]??[]){
    const fileKey=[file.name,file.size,file.lastModified,file.type].join(':');
    if(uploaded.has(fileKey))continue;
    const f=new FormData();f.set('contribution',contributionId);f.set('file',file);
    const up=await fetch('/api/pr43/evidence',{method:'POST',body:f});
    if(!up.ok){const err=await up.json();throw Error(err.error??'Could not upload evidence');}
    uploaded.add(fileKey);
    setUploadedKeys(old=>({...old,[result.id]:[...new Set([...(old[result.id]??[]),fileKey])]}));
   }
   const quantity=Number(values[result.id]??result.quantity);
   const response=await fetch('/api/pr43/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({result:result.id,actor,quantity,impact_result:comments[result.id]??''})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error??'Review failed');
   const level=Number(data.level);
   setLevels(old=>({...old,[result.id]:level}));
   setCompleted(old=>({...old,[result.id]:true}));
   setResultMessages(old=>({...old,[result.id]:{kind:'success',text:`Level ${level} verification saved. Date of proof recorded automatically. A different authorized reviewer is required for the next level.`}}));
  }catch(e){
   setResultMessages(old=>({...old,[result.id]:{kind:'error',text:e instanceof Error?e.message:'Review failed'}}));
  }finally{setPending(null);}
 }
 return <div className="space-y-5">
  <label className="block text-sm">Verify as *<select className={input} value={actor} onChange={e=>setActor(e.target.value)}>{actors.map(a=><option value={a.id} key={a.id}>{a.name} · {a.kind}</option>)}</select></label>
  <label className="block text-sm">Wi-Fi Mesh Community<select className={input} value={community} onChange={e=>{setCommunity(e.target.value);setMission('')}}><option value="">Choose a community</option>{communities.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
  <label className="block text-sm">SDG Mission<select className={input} value={mission} onChange={e=>{setMission(e.target.value);setCommunity('')}}><option value="">Choose a mission</option>{missions.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
  <label className="block text-sm">Search open Contributions<input type="search" className={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, type or description"/></label>
  <h3 className="font-semibold text-ink">Open Contributions ({visible.length})</h3>
  {!visible.length&&<p className="text-sm text-muted">Choose a project to view contributions. Only contributors or authorized organization reviewers can confirm them.</p>}
  {visible.map(item=><section key={item.id} className="space-y-4 rounded-2xl border border-line p-4">
   <p className="deck-label">{item.contribution_type.replaceAll('_',' ')} · {item.contributed_on}</p>
   <h3 className="font-semibold text-ink">{item.title}</h3>
   <p className="whitespace-pre-wrap text-sm">{item.description}</p>
   {['equipment','services','materials','research'].includes(item.contribution_type) && <div className="rounded-xl border border-line p-3 text-sm">
    <p className="font-semibold text-ink">Financial evidence under review</p>
    <p className="mt-2">Classification: {item.details?.nature?.replaceAll('_',' ')??'Not specified'}</p>
    <p>Reported amount / value: {item.details?.amount??'—'} {item.details?.currency??''}</p>
    <p>Paid or provided by: {item.details?.paid_by??'Not specified'}</p>
    <p>Funding source: {item.details?.funding_source?.replaceAll('_',' ')??'Not specified'}</p>
    <p>Payment / delivery reference: {item.details?.payment_reference??'Not specified'}</p>
    {item.contribution_type==='research'&&<p>Research output: {item.details?.research_output??'Not specified'} · Measurement reference: {item.details?.research_method??'Not specified'}</p>}
    <p className="mt-2 text-xs text-muted">Verify the reported classification and amount against supporting evidence before approving. Uploaded evidence alone is not verification.</p>
   </div>}
   <div className="space-y-2"><p className="text-xs text-muted">Uploaded supporting evidence</p>{item.pr43_contribution_files.length?item.pr43_contribution_files.map(file=>file.url?<a key={file.id} target="_blank" rel="noopener noreferrer" href={file.url} className="block break-all text-sm text-gold hover:underline">{file.filename} ↗</a>:<p key={file.id} className="text-sm">{file.filename} (unavailable)</p>):<p className="text-sm text-muted">No attached files.</p>}</div>
   {item.pr43_contribution_results.map(result=>{
    const currentLevel=levels[result.id]??result.verification_level;
    const alreadyReviewed=Boolean(completed[result.id]||currentLevel>=4||(currentLevel>=1&&actor===item.actor_id));
    const notice=resultMessages[result.id];
    return <div key={result.id} className="space-y-3 rounded-xl border border-line bg-panel-raised p-3">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{labels[result.metric_key]??result.metric_key}</span><span className="text-sm text-gold">{currentLevel?'Level '+currentLevel+' verified':'Pending verification'}</span></div>
      <p className="text-sm">Reported: {result.quantity} {result.unit}{result.verified_quantity!==null?' · Verified: '+result.verified_quantity:''}</p>
      {!alreadyReviewed&&<><label className="block text-sm">Confirmed quantity<input type="number" className={input} min="0" max="1000000000" step="any" value={values[result.id]??String(result.quantity)} onChange={e=>setValues(v=>({...v,[result.id]:e.target.value}))}/></label>
      <label className="block text-sm">Additional photos, videos or documents (optional)<input type="file" disabled={alreadyReviewed} multiple accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx" className={input} onChange={e=>setUploads(old=>({...old,[result.id]:Array.from(e.target.files??[])}))}/></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified[result.id]??false} onChange={e=>setVerified(v=>({...v,[result.id]:e.target.checked}))}/>Contribution type verified</label></>}
      {notice&&<p role="status" aria-live="polite" className={notice.kind==='success'?'rounded-lg border border-[#26E7D4] p-3 text-sm text-[#26E7D4]':'rounded-lg border border-red-700 p-3 text-sm text-red-300'}>{notice.text}</p>}
      {!notice&&alreadyReviewed&&<p role="status" className="rounded-lg border border-[#26E7D4] p-3 text-sm text-[#26E7D4]">{currentLevel>=1&&actor===item.actor_id?'Your L1 self-report was recorded. L2 requires a separate authorized organization reviewer.':'This verification was already recorded for this session.'}</p>}
      {!alreadyReviewed&&verified[result.id]&&<><label className="block text-sm">Impact Result (optional)<textarea disabled={alreadyReviewed} className={input} rows={2} value={comments[result.id]??''} onChange={e=>setComments(v=>({...v,[result.id]:e.target.value}))}/></label><p className="text-xs text-muted">Date of Proof: automatically recorded when submitted. Verification role and independence checked by Aluna.</p><button type="button" onClick={()=>review(result,item.id)} disabled={pending!==null||!actor||alreadyReviewed} className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50">{alreadyReviewed?'Verification recorded':pending===result.id?'Submitting…':'Submit verification'}</button></>}
     </div>;
   })}
  </section>)}
 </div>;
}
