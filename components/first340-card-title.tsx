import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { iconColors } from '@/lib/icon-colors';

export function First340CardTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <>
      <Icon aria-hidden="true" size={24} color={iconColors.profile} className="shrink-0" />
      {children}
    </>
  );
}
