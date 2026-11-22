'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { unreadLabel } from '@/lib/social-interactions';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const Count = createContext(0);
export function NotificationCountProvider({children}:{children:React.ReactNode}) {
 const [count,setCount]=useState(0);const pathname=usePathname();
 useEffect(()=>{
  const client=createClient();let active=true;let running=false;let again=false;
  async function refresh(){
   if(running){again=true;return;}running=true;
   do{again=false;const result=await client.from('notifications').select('id',{count:'exact',head:true}).eq('is_read',false);if(active&&!result.error)setCount(result.count??0);}while(active&&again);
   running=false;
  }
  const channel=client.channel('notification-count').on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>{void refresh();}).subscribe(status=>{if(status==='SUBSCRIBED')void refresh();});
  void refresh();const focus=()=>{void refresh();};window.addEventListener('focus',focus);
  return ()=>{active=false;window.removeEventListener('focus',focus);void client.removeChannel(channel);};
 },[pathname]);
 return <Count.Provider value={count}>{children}</Count.Provider>;
}
export function NotificationBadge({placement='inline'}:{placement?:'inline'|'topnav'}){
 const count=useContext(Count);
 const label=unreadLabel(count);
 if(!label)return null;
 const placementClass=placement==='topnav'
  ?'absolute -right-1 -top-1 z-10 inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-navy'
  :'inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-navy';
 return <span aria-label={`${count} unread notifications`} className={placementClass}>{label}</span>;
}
