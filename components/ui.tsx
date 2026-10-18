import { BookUser, BriefcaseBusiness, Building2, ChartNoAxesColumnIncreasing, FileCheck2, HandCoins, HandHeart, Handshake, Network, Newspaper, ShieldCheck, Target, UserRoundPlus, UsersRound, Wifi, UserRoundCheck, Clock3, Wrench, Database, BadgeCheck, Wallet, Scale, History, type LucideIcon } from 'lucide-react';

import { iconColors } from '@/lib/icon-colors';
function cardIcon(title:string):{Icon:LucideIcon;color:string}|null{
 const label=title.toLowerCase();
 if(label.includes('people connected'))return {Icon:UsersRound,color:iconColors.members};
 if(label.includes('wi-fi nodes'))return {Icon:Wifi,color:iconColors.wifi};
 if(label.includes('local owners'))return {Icon:UserRoundCheck,color:iconColors.members};
 if(label.includes('missions completed'))return {Icon:Target,color:iconColors.missions};
 if(label.includes('money raised'))return {Icon:HandCoins,color:iconColors.fundraising};
 if(label.includes('money invested'))return {Icon:Wallet,color:iconColors.fundraising};
 if(label.includes('volunteer hours'))return {Icon:Clock3,color:iconColors.contributions};
 if(label.includes('skills contributed'))return {Icon:Wrench,color:iconColors.contributions};
 if(label.includes('organizations involved'))return {Icon:Building2,color:iconColors.organization};
 if(label.includes('sdg metrics'))return {Icon:Target,color:iconColors.missions};
 if(label.includes('community data'))return {Icon:Database,color:iconColors.wifi};
 if(label.includes('verified results'))return {Icon:BadgeCheck,color:iconColors.verification};
 if(label.includes('reported vs verified'))return {Icon:Scale,color:iconColors.verification};
 if(label.includes('impact timeline'))return {Icon:History,color:iconColors.impact};
 if(label.includes('member')||label.includes('people'))return {Icon:UsersRound,color:iconColors.members};
 if(label.includes('post')||label.includes('feed'))return {Icon:Newspaper,color:iconColors.posts};
 if(label.includes('sponsor'))return {Icon:HandHeart,color:iconColors.sponsorships};
 if(label.includes('partner'))return {Icon:Handshake,color:iconColors.partnerships};
 if(label.includes('connection'))return {Icon:Network,color:iconColors.connections};
 if(label.includes('follow'))return {Icon:UserRoundPlus,color:iconColors.following};
 if(label.includes('wi-fi')||label.includes('community')||label.includes('mesh'))return {Icon:Wifi,color:iconColors.wifi};
 if(label.includes('mission')||label.includes('project'))return {Icon:Target,color:iconColors.missions};
 if(label.includes('fundrais')||label.includes('campaign')||label.includes('funding'))return {Icon:HandCoins,color:iconColors.fundraising};
 if(label.includes('contribution')||label.includes('participat'))return {Icon:HandHeart,color:iconColors.contributions};
 if(label.includes('proof'))return {Icon:FileCheck2,color:iconColors.proofs};
 if(label.includes('verif'))return {Icon:ShieldCheck,color:iconColors.verification};
 if(label.includes('impact')||label.includes('score')||label.includes('performance'))return {Icon:ChartNoAxesColumnIncreasing,color:iconColors.impact};
 if(label.includes('organization')||label.includes('university')||label.includes('ngo')||label.includes('company'))return {Icon:Building2,color:iconColors.organization};
 if(label.includes('profile')||label.includes('about'))return {Icon:BookUser,color:iconColors.profile};
 if(label.includes('invite'))return {Icon:BriefcaseBusiness,color:iconColors.invitation};
 return null;
}
export function Card({ title, children, className = '', iconColor }: {title:React.ReactNode;children:React.ReactNode;className?:string;iconColor?:string}) {
 const icon=typeof title==='string'?cardIcon(title):null;
 return <section className={`glass rounded-3xl p-6 sm:p-8 ${className}`}><h2 className="flex items-center gap-3 text-lg font-semibold">{icon?<icon.Icon aria-hidden="true" size={24} color={iconColor??icon.color} className="shrink-0"/>:iconColor?<ChartNoAxesColumnIncreasing aria-hidden="true" size={24} color={iconColor} className="shrink-0"/>:null}{title}</h2><div className="mt-4 text-muted">{children}</div></section>;
}
export function Placeholder({ title, description }: {title:string;description:string}) {
  return <Card title={title} className="min-h-64"><p className="max-w-xl leading-relaxed">{description}</p><span className="mt-8 inline-block rounded-sm bg-gold/20 px-4 py-2 text-xs font-semibold tracking-wide text-ink">COMING SOON</span></Card>;
}
