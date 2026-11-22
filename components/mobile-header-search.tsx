'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
export function MobileHeaderSearch() {
 return <Link
  href="/search"
  aria-label="Search people and organizations"
  title="Search people and organizations"
  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white hover:bg-panel-raised lg:hidden"
 ><Search size={21} aria-hidden="true"/></Link>;
}
