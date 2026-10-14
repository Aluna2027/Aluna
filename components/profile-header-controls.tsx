'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';

export function ProfileHeaderControls() {
 const pathname=usePathname();
 const ownProfile=pathname==='/profile';
 const organizations=pathname==='/organizations';
 const communities=pathname==='/communities';
 const missions=pathname==='/missions';
 const organizationDetail=/^\/organizations\/[^/]+$/.test(pathname);
 return <>{missions&&<div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 flex-col items-center justify-center xl:flex" aria-label="SDG Missions directory title"><p className="deck-label">PEOPLE · PLACES · PURPOSE</p><h1 className="mt-1 text-3xl text-ink">SDG Missions</h1></div>}{organizations&&<div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 flex-col items-center justify-center xl:flex" aria-label="Organizations page title"><p className="deck-label">ALUNA ACTORS</p><h1 className="mt-1 text-3xl text-ink">Organizations</h1></div>}<div className={ownProfile?'ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3':'ml-auto'}>
  {organizationDetail?<Link href="/organizations" className="shrink-0 text-sm font-semibold text-gold hover:underline">← Organizations</Link>:<form action="/search" className="glass flex min-w-0 items-center gap-2 rounded-xl px-4 py-2 text-sm text-muted">
   <Search size={18} className="shrink-0"/>
   <input name="q" type="search" aria-label="Search people and organizations" placeholder="Search people & organizations" className="w-44 min-w-0 bg-transparent outline-none sm:w-56"/>
  </form>}
  {ownProfile&&<Link href="/settings" className="shrink-0 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-gold hover:bg-panel-raised">Account settings</Link>}
 </div></>;
}
