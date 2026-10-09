'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell,Building2,ChevronDown,CircleUserRound,Globe2,LayoutDashboard,Mail,Newspaper,RadioTower,Target,HeartHandshake,HandHeart,BadgeCheck } from 'lucide-react';

const primary=[
 {href:'/dashboard',label:'Overview',icon:LayoutDashboard},
 {href:'/feed',label:'Global feed',icon:Newspaper},
 {href:'/profile',label:'Profile',icon:CircleUserRound},
 {href:'/messages',label:'Messages',icon:Mail},
 {href:'/notifications',label:'Notifications',icon:Bell},
 {href:'/following',label:'Following',icon:CircleUserRound},
 {href:'/organizations',label:'Organizations',icon:Building2},
 {href:'/world-map',label:'World map',icon:Globe2},
];
const secondary=[
 {href:'/communities',label:'Mesh communities',icon:RadioTower},
 {href:'/missions',label:'SDG Missions',icon:Target},
 {href:'/fundraising',label:'SDG Fundraising',icon:HeartHandshake},
 {href:'/contributions',label:'Contributions',icon:HandHeart},
 {href:'/proofs',label:'Proofs',icon:BadgeCheck},
 {href:'/impact',label:'Impact',icon:BadgeCheck},
 {href:'/donations',label:'My donations',icon:HeartHandshake},
];

export function SidebarNav({onNavigate}:{onNavigate?:()=>void}={}){
 const pathname=usePathname();const [moreOpen,setMoreOpen]=useState(false);
 useEffect(()=>{if(!secondary.some(i=>pathname===i.href||pathname.startsWith(i.href+'/')))setMoreOpen(false);},[pathname]);
 const cls=(href:string)=>`flex items-center gap-2 rounded-xl px-3 py-3 text-sm transition-colors ${pathname===href||pathname.startsWith(href+'/')?'bg-nav-active text-ink':'hover:bg-panel-raised'}`;
 return <nav aria-label="Main navigation" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
  {primary.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>{setMoreOpen(false);onNavigate?.();}} className={cls(href)}><Icon size={18}/>{label}</Link>)}
  <button type="button" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)} className="flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm hover:bg-panel-raised"><ChevronDown size={18} className={moreOpen?'rotate-180 transition-transform':'transition-transform'}/>More</button>
  {moreOpen&&secondary.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={onNavigate} className={`${cls(href)} lg:pl-7`}><Icon size={18}/>{label}</Link>)}
 </nav>;
}
