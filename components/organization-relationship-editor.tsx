'use client';
import { useState } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { saveOrganizationRelationship } from '@/app/(app)/organizations/membership-actions';
type Choice={id:string;name:string;kind:'Person'|'Organization'};
export function RelationshipEditor({organizationId,kind,existing}:{organizationId:string;kind:'partnership'|'sponsorship';existing?:{id:string;name:string;participants:Choice[]}}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[results,setResults]=useState<Choice[]>([]);
 const [selected,setSelected]=useState<Choice[]>(existing?.participants??[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function search(){
  const needle=query.trim();if(needle.length<2){setResults([]);return;}
  setBusy(true);setError('');
  try{
   const db=createClient(),safe=needle.replace(/[%_,()]/g,' ').trim();
   const [people,orgs]=await Promise.all([
    db.from('public_profiles').select('id,display_name').ilike('display_name',`%${safe}%`).limit(15),
    db.from('organizations').select('id,name').ilike('name',`%${safe}%`).is('removed_at',null).limit(15)
   ]);
   if(people.error||orgs.error){setError('Search failed. Please try again.');return;}
   const pids=(people.data??[]).map(x=>x.id),oids=(orgs.data??[]).map(x=>x.id);
   const [pa,oa]=await Promise.all([
    pids.length?db.from('actors').select('id,profile_id').in('profile_id',pids):Promise.resolve({data:[]}),
    oids.length?db.from('actors').select('id,organization_id').in('organization_id',oids):Promise.resolve({data:[]})
   ]);
   const personNames=new Map((people.data??[]).map(x=>[x.id,x.display_name]));
   const orgNames=new Map((orgs.data??[]).map(x=>[x.id,x.name]));
   setResults([
    ...(pa.data??[]).map(x=>({id:x.id,name:personNames.get(x.profile_id??'')??'Person',kind:'Person' as const})),
    ...(oa.data??[]).map(x=>({id:x.id,name:orgNames.get(x.organization_id??'')??'Organization',kind:'Organization' as const}))
   ]);
  }finally{setBusy(false);}
 }
 const choose=(choice:Choice)=>setSelected(old=>old.some(c=>c.id===choice.id)?old:[...old,choice]);
 return <>
  <button type="button" onClick={()=>{setOpen(true);setSelected(existing?.participants??[]);}} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold px-3 py-2 text-sm text-gold"><Plus size={17}/>{existing?'Edit':'Create'} {kind}</button>
  {open&&<div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={()=>setOpen(false)}>
   <div role="dialog" aria-modal="true" aria-label={`Manage ${kind}`} onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-2xl">
    <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold">{existing?'Edit':'Create'} {kind}</h3><button type="button" onClick={()=>setOpen(false)} aria-label="Close"><X size={22}/></button></div>
    <form action={saveOrganizationRelationship} className="space-y-4">
     <input type="hidden" name="organization_id" value={organizationId}/><input type="hidden" name="kind" value={kind}/>
     {existing&&<input type="hidden" name="id" value={existing.id}/>}
     <input type="hidden" name="participants" value={selected.map(c=>c.id).join(',')}/>
     <label className="block text-sm">Name<input name="name" required minLength={2} maxLength={160} defaultValue={existing?.name||''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
     <label className="block text-sm">People and organizations<div className="mt-2 flex gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}} placeholder="Search names" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/><button type="button" onClick={()=>void search()} disabled={busy} className="rounded-xl border border-gold p-3 text-gold"><Search size={20}/></button></div></label>
     {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
     {results.length>0&&<div className="max-h-44 overflow-y-auto rounded-xl border border-line">{results.map(choice=><button type="button" key={choice.id} onClick={()=>choose(choice)} disabled={selected.some(c=>c.id===choice.id)} className="block w-full border-b border-line p-3 text-left text-sm hover:bg-panel-raised disabled:opacity-50">{choice.name} <span className="text-muted">· {choice.kind}</span></button>)}</div>}
     <div className="flex flex-wrap gap-2">{selected.map(c=><span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-panel-raised px-3 py-1 text-sm">{c.name}<button type="button" aria-label={`Remove ${c.name}`} onClick={()=>setSelected(old=>old.filter(x=>x.id!==c.id))}><X size={15}/></button></span>)}</div>
     <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">{existing?'Save changes':'Create'}</button>
    </form>
   </div>
  </div>}
 </>;
}
