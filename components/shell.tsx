import { NotificationBadge, NotificationCountProvider } from '@/components/notification-count';
import Link from 'next/link';
import { Bell, CircleUserRound, Globe2, Mail } from 'lucide-react';
import { ShellWelcomeRow } from '@/components/shell-welcome-row';
import { signOut } from '@/app/(auth)/login/actions';
import { SidebarNav } from '@/components/sidebar-nav';
import { MobileSidebarMenu } from '@/components/mobile-sidebar-menu';
import { MobileHeaderSearch } from '@/components/mobile-header-search';
import { MobileShellLayout } from '@/components/mobile-shell-layout';

export function Shell({ children, name, isAlunaSuperAdmin = false }: { children:React.ReactNode; name:string; isAlunaSuperAdmin?:boolean }) {
  return <NotificationCountProvider><div className="min-h-screen bg-navy">
    <header className="glass sticky top-0 z-10 px-3 py-3 sm:px-8 sm:py-4"><div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-0 sm:gap-5 lg:flex">
      <div className="flex min-w-0 items-center gap-0 sm:gap-1">
        <MobileSidebarMenu isAlunaSuperAdmin={isAlunaSuperAdmin}/>
        <MobileHeaderSearch/>
      </div>
      <Link href="/dashboard" className="justify-self-center shrink-0 lg:justify-self-auto" aria-label="Aluna dashboard"><img src="/aluna-logo-auth.svg" alt="ALUNA" className="block h-6 w-auto sm:h-7"/></Link>
      <div className="hidden text-xs tracking-[.15em] text-muted lg:block">GLOBAL NETWORK</div>
      <div className="ml-auto flex min-w-0 items-center justify-end gap-0 sm:gap-1 lg:gap-2"><Link href="/messages" aria-label="Messages" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-panel-raised lg:h-auto lg:w-auto lg:p-2"><Mail size={20}/></Link><Link href="/notifications" aria-label="Notifications" className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-panel-raised lg:h-auto lg:w-auto lg:p-2"><Bell size={20}/><NotificationBadge placement="topnav"/></Link><details className="relative"><summary aria-label="Profile menu" className="grid h-9 w-9 shrink-0 cursor-pointer list-none place-items-center rounded-xl hover:bg-panel-raised lg:h-auto lg:w-auto lg:p-2"><CircleUserRound size={20}/></summary><div className="absolute right-0 z-30 mt-2 w-52 max-w-[calc(100vw-2.5rem)] rounded-xl border border-line bg-panel p-2 text-sm break-words [overflow-wrap:anywhere] shadow-xl"><Link href="/profile" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Profile</Link><Link href="/profile/edit" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Edit profile</Link><Link href="/settings#email" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Change email</Link><Link href="/settings#password" className="block rounded-lg px-3 py-2 hover:bg-panel-raised">Change password</Link></div></details></div>
    </div></header>
    <MobileShellLayout>
      <aside className="glass hidden h-fit rounded-2xl p-3 lg:block"><div className="mb-3 flex items-center gap-2 px-3 py-3 text-sm font-semibold"><Globe2 size={18} className="text-gold"/> Network</div>
        <SidebarNav isAlunaSuperAdmin={isAlunaSuperAdmin}/>
        <form action={signOut} className="mt-3 border-t border-line px-3 pt-4"><button className="text-sm text-muted hover:text-ink">Sign out</button></form>
      </aside>
      <main className="min-w-0"><ShellWelcomeRow name={name}/>{children}</main>
    </MobileShellLayout>
  </div></NotificationCountProvider>;
}
