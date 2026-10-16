import { BookUser, BriefcaseBusiness, Building2, ChartNoAxesColumnIncreasing, FileCheck2, HandCoins, HandHeart, Handshake, Network, Newspaper, ShieldCheck, Target, UserRoundPlus, UsersRound, Wifi, type LucideIcon } from 'lucide-react';

function cardIcon(title:string):LucideIcon|null{
 const label=title.toLowerCase();
 if(label.includes('member')||label.includes('people'))return UsersRound;
 if(label.includes('post')||label.includes('feed'))return Newspaper;
 if(label.includes('sponsor'))return HandHeart;
 if(label.includes('partner'))return Handshake;
 if(label.includes('connection'))return Network;
 if(label.includes('follow'))return UserRoundPlus;
 if(label.includes('wi-fi')||label.includes('community')||label.includes('mesh'))return Wifi;
 if(label.includes('mission')||label.includes('project'))return Target;
 if(label.includes('fundrais')||label.includes('campaign')||label.includes('funding'))return HandCoins;
 if(label.includes('contribution')||label.includes('participat'))return HandHeart;
 if(label.includes('proof'))return FileCheck2;
 if(label.includes('verif'))return ShieldCheck;
 if(label.includes('impact')||label.includes('score')||label.includes('performance'))return ChartNoAxesColumnIncreasing;
 if(label.includes('organization')||label.includes('university')||label.includes('ngo')||label.includes('company'))return Building2;
 if(label.includes('profile')||label.includes('about'))return BookUser;
 if(label.includes('invite'))return BriefcaseBusiness;
 return null;
}
export function Card({ title, children, className = '' }: {title:string;children:React.ReactNode;className?:string}) {
 const Icon=cardIcon(title);
 return <section className={`glass rounded-3xl p-6 sm:p-8 ${className}`}><h2 className="flex items-center gap-3 text-lg font-semibold">{Icon&&<Icon aria-hidden="true" size={24} className="shrink-0 text-[#26E7D4]"/>}{title}</h2><div className="mt-4 text-muted">{children}</div></section>;
}
export function Placeholder({ title, description }: {title:string;description:string}) {
  return <Card title={title} className="min-h-64"><p className="max-w-xl leading-relaxed">{description}</p><span className="mt-8 inline-block rounded-sm bg-gold/20 px-4 py-2 text-xs font-semibold tracking-wide text-ink">COMING SOON</span></Card>;
}
