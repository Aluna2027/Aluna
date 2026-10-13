'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tabSlug } from '@/lib/profiles';

export function ProfileTabs({base,tabs,active}:{base:string;tabs:readonly string[];active:string}) {
 const [selected,setSelected]=useState(active);
 useEffect(()=>setSelected(active),[active]);
 return <nav aria-label="Profile sections" className="flex gap-2 overflow-x-auto pb-2">{tabs.map(label=>{const slug=tabSlug(label);return <Link key={label} href={`${base}?tab=${slug}`} scroll={false} aria-current={selected===slug?'page':undefined} onClick={()=>setSelected(slug)} className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors duration-150 ${selected===slug?'bg-gold text-navy':'glass hover:bg-panel-raised'}`}>{label}</Link>})}</nav>;
}
