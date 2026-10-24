'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { isCompactMobilePage } from '@/lib/mobile-compact-pages';

export function MobileHeaderSearch() {
 const pathname = usePathname();
 if (!isCompactMobilePage(pathname)) return null;
 return <Link
  href="/search"
  aria-label="Search people and organizations"
  title="Search people and organizations"
  className="absolute left-[calc(25%_-_20px)] top-1/2 z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl text-white hover:bg-panel-raised lg:hidden"
 ><Search size={21} aria-hidden="true"/></Link>;
}
