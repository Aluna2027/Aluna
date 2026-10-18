'use client';
import Link from 'next/link';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { removeOrganizationCard } from '@/app/(app)/organizations/card-actions';

type Resource='community'|'mission'|'campaign';
export function OrganizationCardMenu({organizationId,id,title,resource}:{organizationId:string;id:string;title:string;resource:Resource}){
 const [open,setOpen]=useState(false);
 const editHref=resource==='community'?'/communities/'+id+'/edit':resource==='mission'?'/missions/'+id+'/edit':'/fundraising/campaigns/'+id+'/edit';
 return <div className="absolute right-4 top-4 z-10">
  <button type="button" aria-label={'Manage '+title} aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(v=>!v)} className="flex size-10 items-center justify-center rounded-xl border border-line bg-panel-raised text-ink hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"><MoreVertical size={21}/></button>
  {open&&<><button type="button" aria-label="Close card menu" className="fixed inset-0 z-10 cursor-default" onClick={()=>setOpen(false)}/><div role="menu" aria-label={'Actions for '+title} className="absolute right-0 top-12 z-20 w-44 rounded-xl border border-line bg-panel p-2 shadow-2xl">
   <Link role="menuitem" href={editHref} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-panel-raised"><Pencil size={17}/>Edit</Link>
   <form action={removeOrganizationCard} onSubmit={e=>{const label=resource==='campaign'?'Delete or archive':'Delete';if(!window.confirm(label+' '+title+'? This cannot be undone when deletion is permitted.'))e.preventDefault();}}>
    <input type="hidden" name="organization_id" value={organizationId}/><input type="hidden" name="id" value={id}/><input type="hidden" name="resource" value={resource}/>
    <button role="menuitem" type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-panel-raised"><Trash2 size={17}/>{resource==='campaign'?'Delete / Archive':'Delete'}</button>
   </form>
  </div></>}
 </div>;
}
