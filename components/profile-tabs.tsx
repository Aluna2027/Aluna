import Link from 'next/link';
import { tabSlug } from '@/lib/profiles';
export function ProfileTabs({ base, tabs, active }: {base:string; tabs:readonly string[]; active:string}) {
 return <nav aria-label="Profile sections" className="flex gap-2 overflow-x-auto pb-2">{tabs.map(label=><Link key={label} href={`${base}?tab=${tabSlug(label)}`} aria-current={active===tabSlug(label)?'page':undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm ${active===tabSlug(label)?'bg-gold text-navy':'glass hover:bg-panel-raised'}`}>{label}</Link>)}</nav>;
}
