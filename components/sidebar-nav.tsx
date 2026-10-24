'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell,Building2,ChevronDown,CircleUserRound,Globe2,LayoutDashboard,Mail,Newspaper,RadioTower,Target,HeartHandshake,HandHeart,BadgeCheck,ShieldCheck } from 'lucide-react';

const primary=[
 {href:'/dashboard',label:'Overview',icon:LayoutDashboard},
 {href:'/feed',label:'Global feed',icon:Newspaper},
 {href:'/following',label:'Personal time-line',icon:CircleUserRound},
 {href:'/profile',label:'Profile',icon:CircleUserRound},
 {href:'/messages',label:'Messages',icon:Mail},
 {href:'/notifications',label:'Notifications',icon:Bell},
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

export function SidebarNav({onNavigate,isAlunaSuperAdmin=false}:{onNavigate?:()=>void;isAlunaSuperAdmin?:boolean}={}){
 const pathname=usePathname();const [moreOpen,setMoreOpen]=useState(false);
 useEffect(()=>{if(!secondary.some(i=>pathname===i.href||pathname.startsWith(i.href+'/')))setMoreOpen(false);},[pathname]);
 const cls=(href:string)=>`flex min-w-0 items-center gap-2 rounded-xl px-3 py-3 text-sm transition-colors ${pathname===href||pathname.startsWith(href+'/')?'bg-nav-active text-ink':'hover:bg-panel-raised'}`;
 return <nav aria-label="Main navigation" className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
  {primary.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>{setMoreOpen(false);onNavigate?.();}} className={cls(href)}><Icon size={18} className="shrink-0"/><span className="min-w-0 break-words [overflow-wrap:anywhere]">{label}</span></Link>)}
  {isAlunaSuperAdmin&&<Link href="/aluna-admin" onClick={()=>{setMoreOpen(false);onNavigate?.();}} className={cls("/aluna-admin")}><ShieldCheck size={18} className="shrink-0"/><span className="min-w-0 break-words [overflow-wrap:anywhere]">Admin</span></Link>}
  <button type="button" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)} className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-3 text-left text-sm hover:bg-panel-raised"><ChevronDown size={18} className={moreOpen?'shrink-0 rotate-180 transition-transform':'shrink-0 transition-transform'}/><span className="min-w-0 break-words">More</span></button>
  {moreOpen&&secondary.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={onNavigate} className={`${cls(href)} lg:pl-7`}><Icon size={18} className="shrink-0"/><span className="min-w-0 break-words [overflow-wrap:anywhere]">{label}</span></Link>)}
 </nav>;
}
