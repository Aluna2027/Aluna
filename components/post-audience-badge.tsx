import { Globe2, LockKeyhole, UsersRound } from 'lucide-react';

export function PostAudienceBadge({ visibility }: { visibility: string }) {
 const membersOnly = visibility === 'members';
 const followersOnly = visibility === 'followers';
 const Icon = membersOnly ? LockKeyhole : followersOnly ? UsersRound : Globe2;
 const label = membersOnly ? 'Members only' : followersOnly ? 'Followers' : 'Everyone';
 return <span aria-label={`Audience: ${label}`} title={label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-raised px-2 py-1 text-xs text-muted">
  <Icon aria-hidden="true" size={14} className={membersOnly ? 'text-[#FFC43D]' : 'text-[#26E7D4]'}/>{label}
 </span>;
}
