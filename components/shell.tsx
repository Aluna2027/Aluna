import Link from 'next/link';
import { Bell, CircleUserRound, Globe2, Mail, Search } from 'lucide-react';
import { signOut } from '@/app/(auth)/login/actions';
import { SidebarNav } from '@/components/sidebar-nav';

export function Shell({ children, name }: { children:React.ReactNode; name:string }) {
  return <div className="min-h-screen bg-navy">
    <header className="glass sticky top-0 z-10 px-5 py-4 sm:px-8"><div className="mx-auto flex max-w-7xl items-center gap-5">
      <Link href="/dashboard" className="shrink-0 text-xl font-black tracking-[.18em]">ALUNA<span className="text-gold">.</span></Link>
      <div className="hidden text-xs tracking-[.15em] text-muted lg:block">GLOBAL NETWORK</div>
      <div className="ml-auto flex items-center gap-2"><Link href="/messages" aria-label="Messages" className="rounded-xl p-2 hover:bg-panel-raised"><Mail size={20}/></Link><Link href="/notifications" aria-label="Notifications" className="rounded-xl p-2 hover:bg-panel-raised"><Bell size={20}/></Link><Link href="/profile" aria-label="Profile" className="rounded-xl p-2 hover:bg-panel-raised"><CircleUserRound size={20}/></Link></div>
    </div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[220px_1fr]">
      <aside className="glass h-fit rounded-2xl p-3"><div className="mb-3 flex items-center gap-2 px-3 py-3 text-sm font-semibold"><Globe2 size={18} className="text-gold"/> Network</div>
        <SidebarNav/>
        <form action={signOut} className="mt-3 border-t border-line px-3 pt-4"><button className="text-sm text-muted hover:text-ink">Sign out</button></form>
      </aside>
      <main className="min-w-0"><div className="mb-6 flex flex-wrap items-center gap-4"><div><p className="deck-label">PEOPLE · PLACES · POSSIBILITY</p><p className="mt-1 text-sm text-muted">Welcome, {name}</p></div><form action="/search" className="glass ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-muted"><Search size={18}/><input name="q" type="search" aria-label="Search people and organizations" placeholder="Search people & organizations" className="w-44 bg-transparent outline-none sm:w-56"/></form></div>{children}</main>
    </div>
  </div>;
}
