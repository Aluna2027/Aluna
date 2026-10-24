import Link from 'next/link';
import type { ReactNode } from 'react';
import { DirectorySdgIcon } from '@/components/directory-sdg-icon';
import { sdgLabel } from '@/lib/sdgs';

export function DetailPageHeader({kind,title,backHref,backLabel,visitorName,mobileCompact=false}:{
 kind:string;title:string;backHref:string;backLabel:string;visitorName:string;mobileCompact?:boolean;
}){
 return <header className={mobileCompact?'min-w-0 border-line lg:border-b lg:pb-7':'min-w-0 border-b border-line pb-7'}>
   <div className={mobileCompact?'grid min-w-0 grid-cols-1 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1fr)]':'grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1fr)]'}>
    <div className={mobileCompact?'hidden min-w-0 lg:block':'min-w-0'}><p className="text-[11px] font-bold uppercase leading-tight text-gold sm:text-[13px]">PEOPLE · PLACES · POSSIBILITY</p><p className="mt-1 text-xs text-muted sm:text-base">Welcome, <Link href="/profile" className="font-semibold text-gold hover:underline">{visitorName}</Link></p></div>
    <div className="min-w-0 text-center"><p className="text-xs font-bold uppercase leading-tight text-gold sm:text-sm">{kind}</p><h1 className={`${mobileCompact?'hidden lg:block ':''}mt-2 break-words text-[19px] font-bold normal-case leading-tight text-ink [font-stretch:normal] sm:text-[27px]`}>{title}</h1></div>
    <Link href={backHref} className={`${mobileCompact?'hidden lg:block ':''}min-w-0 break-words text-right text-xs font-semibold text-gold hover:underline sm:text-base`}>← <span className="hidden sm:inline">{backLabel}</span><span className="sm:hidden">{backLabel==='Wi-Fi Mesh Communities'?'Communities':backLabel}</span></Link>
   </div>
  </header>;
}

export function MobileDetailIdentityCard({name,icon}:{name:string;icon:ReactNode}){
 return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 lg:hidden">
   <span aria-hidden="true" className="shrink-0">{icon}</span>
   <span className="min-w-0 break-words text-sm font-semibold text-ink">{name}</span>
 </div>;
}

export function DetailSectionCard({title,mobileTitle,icon,children,className=''}:{
 title:string;mobileTitle?:string;icon:ReactNode;children:ReactNode;className?:string;
}){
 return <section className={'min-w-0 rounded-[20px] border border-line bg-panel p-[18px] sm:p-5 '+className}>
   <div className="flex items-center gap-3"><span aria-hidden="true" className="shrink-0">{icon}</span><h2 className="min-w-0 text-[18px] font-bold uppercase leading-snug text-ink [font-stretch:normal] sm:text-[23px]">{mobileTitle?<><span className="sm:hidden">{mobileTitle}</span><span className="hidden sm:inline">{title}</span></>:title}</h2></div>
   <div className="mt-6 border-t border-line pt-6 text-base leading-relaxed text-muted sm:text-lg">{children}</div>
  </section>;
}

export function DetailMetricCard({label,value,icon}:{
 label:string;value:ReactNode;icon:ReactNode;
}){
 return <section className="min-w-0 rounded-[18px] border border-line bg-panel p-[18px]">
  <div aria-hidden="true">{icon}</div>
  <p className="mt-3 text-xs font-medium uppercase text-muted">{label}</p>
  <p className="mt-4 break-words text-[21px] font-semibold normal-case leading-tight text-ink [font-stretch:normal] sm:text-[23px]">{value}</p>
 </section>;
}

export function DetailSdgIcons({numbers,primary}:{numbers:number[];primary:number}){
 return <div className="flex min-w-0 items-center justify-between gap-3">
   <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#173638] sm:size-16"><DirectorySdgIcon number={primary} size={29}/></span>
   <div className="flex flex-wrap justify-end gap-3">{numbers.filter(n=>n!==primary).map(n=><DirectorySdgIcon key={n} number={n} size={24}/>)}</div>
  </div>;
}
export function DetailSdgRows({numbers,primary}:{numbers:number[];primary:number}){
 return <div className="space-y-1">{[primary,...numbers.filter(n=>n!==primary)].map((n,i)=><p key={n} className={i===0?'font-semibold text-gold':'text-muted'}>{sdgLabel(n)}</p>)}</div>;
}

// No primary SDG is persisted yet; prioritize connectivity SDG 9 only for physically
// linked Wi-Fi mesh missions, otherwise follow the application's existing sorted order.
export function featuredSdg(numbers:number[],hasMeshCommunity=false){
 return hasMeshCommunity&&numbers.includes(9)?9:numbers[0]??9;
}
