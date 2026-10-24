'use client';

import { usePathname } from 'next/navigation';
import { isCompactMobilePage } from '@/lib/mobile-compact-pages';

export function MobileShellLayout({children}:{children:React.ReactNode}) {
 const pathname = usePathname();
 const compact = isCompactMobilePage(pathname);
 return <div className={`mx-auto grid max-w-7xl gap-6 px-5 sm:px-8 lg:grid-cols-[220px_1fr] ${compact?'pt-3 pb-7 lg:py-7':'py-7'}`}>{children}</div>;
}
