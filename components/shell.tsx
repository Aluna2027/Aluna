import Link from 'next/link';
import { Bell, CircleUserRound, Globe2, Mail } from 'lucide-react';
import { ShellWelcomeRow } from '@/components/shell-welcome-row';
import { signOut } from '@/app/(auth)/login/actions';
import { SidebarNav } from '@/components/sidebar-nav';
import { MobileSidebarMenu } from '@/components/mobile-sidebar-menu';
import { MobileHeaderSearch } from '@/components/mobile-header-search';
import { MobileShellLayout } from '@/components/mobile-shell-layout';

export function Shell({ children, name, isAlunaSuperAdmin = false }: { children:React.ReactNode; name:string; isAlunaSuperAdmin?:boolean }) {
  return <div className="min-h-screen bg-navy">
    <header className="glass sticky top-0 z-10 px-5 py-4 sm:px-8"><div className="relative mx-auto flex max-w-7xl items-center gap-5">
      <MobileSidebarMenu isAlunaSuperAdmin={isAlunaSuperAdmin}/>
      <MobileHeaderSearch/>
      <Link href="/dashboard" className="absolute left-1/2 shrink-0 -translate-x-1/2 bg-[#11151F] lg:static lg:translate-x-0" aria-label="Aluna dashboard"><img src="/aluna-logo-auth.svg" alt="ALUNA" className="block h-7 w-auto"/></Link>
      <div className="hidden text-xs tracking-[.15em] text-muted lg:block">GLOBAL NETWORK</div>
      <div className="ml-auto flex items-center gap-2"><Link href="/messages" aria-label="Messages" className="rounded-xl p-2 hover:bg-panel-raised"><Mail size={20}/></Link><Link href="/notifications" aria-label="Notifications" className="rounded-xl p-2 hover:bg-panel-raised"><Bell size={20}/></Link><details className="relative"><summary aria-label="Profile menu" className="grid cursor-pointer list-none place-items-center rounded-xl p-2 hover:bg-panel-raised"><CircleUserRound size={20}/></summary><div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-line bg-panel p-2 text-sm shadow-xl"><Link href="/profile" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Profile</Link><Link href="/profile/edit" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Edit profile</Link><Link href="/settings#email" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Change email</Link><Link href="/settings#password" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Change password</Link></div></details></div>
    </div></header>
    <MobileShellLayout>
      <aside className="glass hidden h-fit rounded-2xl p-3 lg:block"><div className="mb-3 flex items-center gap-2 px-3 py-3 text-sm font-semibold"><Globe2 size={18} className="text-gold"/> Network</div>
        <SidebarNav isAlunaSuperAdmin={isAlunaSuperAdmin}/>
        <form action={signOut} className="mt-3 border-t border-line px-3 pt-4"><button className="text-sm text-muted hover:text-ink">Sign out</button></form>
      </aside>
      <main className="min-w-0"><ShellWelcomeRow name={name}/>{children}</main>
    </MobileShellLayout>
  </div>;
}
