'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProfileHeaderControls } from '@/components/profile-header-controls';
import { isCompactMobilePage } from '@/lib/mobile-compact-pages';

export function ShellWelcomeRow({ name }: { name: string }) {
  const pathname = usePathname();
  const compactMobile = isCompactMobilePage(pathname);
  // Community, mission and fundraising detail pages render their own compact header.
  const fundraisingDetail=/^\/fundraising\/campaigns\/[^/]+\/?$/.test(pathname) || (/^\/fundraising\/[^/]+\/?$/.test(pathname) && !['/fundraising/new','/fundraising/performance'].includes(pathname));
  const detailSegments=pathname.split('/').filter(Boolean);
  if ((detailSegments.length===2&&['communities','missions'].includes(detailSegments[0])) || fundraisingDetail) return null;

  // Keep the directory title in the same header row as the welcome label on wide screens.
  // A grid reserves separate space for each column so the centered title cannot cover either side.
  const directoryHeading=pathname==='/communities'
    ?{label:'PHYSICAL PLACES · COMMUNITY-OWNED CONNECTIVITY',title:'Wi-Fi Mesh Communities'}
    :pathname==='/fundraising'
      ?{label:'SDG MISSION FUNDRAISING',title:'SDG Fundraising'}
      :null;
  if(directoryHeading)return <div className={`${compactMobile?'mb-3 lg:mb-6':'mb-6'} grid min-w-0 grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)_minmax(0,1fr)] xl:items-start`}>
    <div className="hidden min-w-0 lg:block sm:col-start-1 sm:row-start-1">
      <p className="deck-label">PEOPLE · PLACES · POSSIBILITY</p>
      <p className="mt-1 text-sm text-muted">Welcome, <Link href="/profile" className="font-semibold text-gold hover:underline" aria-label="Open my profile">{name}</Link></p>
    </div>
    <div className="min-w-0 text-center sm:col-span-2 sm:row-start-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
      <p className="whitespace-normal text-[.68rem] font-extrabold uppercase leading-tight tracking-[.07em] text-gold">{directoryHeading.label}</p>
      <h1 className="mt-1 break-words text-2xl text-ink sm:text-3xl xl:text-[1.7rem]">{directoryHeading.title}</h1>
    </div>
    <div className="hidden min-w-0 justify-self-end sm:col-start-2 sm:row-start-1 xl:col-start-3 lg:block"><ProfileHeaderControls/></div>
  </div>;

  if (pathname==='/search') return <div className="relative mb-3 flex flex-wrap items-center gap-4 lg:mb-6">
    <div>
      <p className="deck-label">PEOPLE · PLACES · POSSIBILITY</p>
      <p className="mt-1 text-sm text-muted">Welcome, <Link href="/profile" className="font-semibold text-gold hover:underline" aria-label="Open my profile">{name}</Link></p>
    </div>
    <div className="hidden lg:block"><ProfileHeaderControls/></div>
  </div>;

  return <div className={`${compactMobile?'hidden lg:flex':'flex'} relative mb-6 flex-wrap items-center gap-4`}>
    <div>
      <p className="deck-label">PEOPLE · PLACES · POSSIBILITY</p>
      <p className="mt-1 text-sm text-muted">Welcome, <Link href="/profile" className="font-semibold text-gold hover:underline" aria-label="Open my profile">{name}</Link></p>
    </div>
    <ProfileHeaderControls/>
  </div>;
}
