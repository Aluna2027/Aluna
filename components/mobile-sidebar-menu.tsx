'use client';

import { useEffect,useState } from 'react';
import { Menu } from 'lucide-react';
import { SidebarNav } from '@/components/sidebar-nav';
import { signOut } from '@/app/(auth)/login/actions';

export function MobileSidebarMenu(){
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  document.body.style.overflow=open?'hidden':'';
  return ()=>{document.body.style.overflow='';};
 },[open]);

 return <>
  <button type="button" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-panel-raised lg:hidden">
   <Menu size={24}/>
  </button>
  <div className={`fixed inset-0 z-50 transition-opacity duration-300 lg:hidden ${open?'pointer-events-auto opacity-100':'pointer-events-none opacity-0'}`} role="dialog" aria-modal="true" aria-label="Main navigation" aria-hidden={!open}>
   <button type="button" aria-label="Close navigation" onClick={()=>setOpen(false)} className="absolute inset-0 bg-black/55"/>
   <aside className={`glass absolute inset-y-0 left-0 w-4/5 overflow-y-auto rounded-r-2xl p-3 shadow-2xl transition-transform duration-300 ease-out ${open?'translate-x-0':'-translate-x-full'}`}>
    <div className="mb-3 flex items-center gap-2 px-3 py-3 text-sm font-semibold">Navigation</div>
    <SidebarNav onNavigate={()=>setOpen(false)}/>
    <form action={signOut} className="mt-3 border-t border-line px-3 pt-4"><button className="text-sm text-muted hover:text-ink">Sign out</button></form>
   </aside>
  </div>
 </>;
}
