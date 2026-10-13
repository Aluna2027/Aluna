'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';

export function ProfileHeaderControls() {
 const pathname=usePathname();
 const ownProfile=pathname==='/profile';
 return <div className={ownProfile?'ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3':'ml-auto'}>
  <form action="/search" className="glass flex min-w-0 items-center gap-2 rounded-xl px-4 py-2 text-sm text-muted">
   <Search size={18} className="shrink-0"/>
   <input name="q" type="search" aria-label="Search people and organizations" placeholder="Search people & organizations" className="w-44 min-w-0 bg-transparent outline-none sm:w-56"/>
  </form>
  {ownProfile&&<Link href="/settings" className="shrink-0 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-gold hover:bg-panel-raised">Account settings</Link>}
 </div>;
}
