'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tabSlug } from '@/lib/profiles';

export function ProfileTabs({base,tabs,active,counts,variant,manage=false}:{base:string;tabs:readonly string[];active:string;counts?:Partial<Record<string,number>>;variant?:'detail';manage?:boolean}) {
 const [selected,setSelected]=useState(active);
 useEffect(()=>setSelected(active),[active]);
 return <nav aria-label="Profile sections" className={variant==='detail'?'flex gap-3 overflow-x-auto pb-2 [scrollbar-color:#4B5262_transparent] [scrollbar-width:thin]':'flex gap-2 overflow-x-auto pb-2'}>{tabs.map(label=>{const slug=tabSlug(label);return <Link key={label} href={`${base}?tab=${slug}${manage?'&manage=1':''}`} scroll={false} aria-current={selected===slug?'page':undefined} onClick={()=>setSelected(slug)} className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-colors duration-150 ${selected===slug?'bg-gold text-navy':variant==='detail'?'bg-[#191E2A] text-ink hover:bg-[#242A38]':'glass hover:bg-panel-raised'}`}>{label==='About'?'Profile':label}{counts?.[slug]!==undefined?` (${counts[slug]})`:''}</Link>})}</nav>;
}
