'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProfileHeaderControls } from '@/components/profile-header-controls';

export function ShellWelcomeRow({ name }: { name: string }) {
  const pathname = usePathname();
  // Mesh detail pages provide their own compact, server-rendered title row.
  if (/^\/communities\/[^/]+\/?$/.test(pathname)) return null;

  return <div className="relative mb-6 flex flex-wrap items-center gap-4">
    <div>
      <p className="deck-label">PEOPLE · PLACES · POSSIBILITY</p>
      <p className="mt-1 text-sm text-muted">Welcome, <Link href="/profile" className="font-semibold text-gold hover:underline" aria-label="Open my profile">{name}</Link></p>
    </div>
    <ProfileHeaderControls/>
  </div>;
}
