import Link from 'next/link';
import { safeUrl } from '@/lib/profiles';
type Score={label:string;value:number|null|undefined};

export function ProfileHeader({ name, kind, country, location, website, imageUrl, editHref, unverified=false, scores=[] }: {name:string;kind:string;country?:string|null;location?:string|null;website?:string|null;imageUrl?:string|null;editHref?:string;unverified?:boolean;scores?:Score[]}) {
 const href=safeUrl(website); const image=safeUrl(imageUrl);
 return <header className="rounded-3xl border border-line bg-panel p-7 sm:p-10"><div className="flex items-start gap-5">{image&&<div role="img" aria-label={`${name} profile image`} className="h-20 w-20 shrink-0 rounded-full border border-line bg-cover bg-center" style={{backgroundImage:`url(${JSON.stringify(image)})`}}/>}<div><p className="deck-label">ALUNA GLOBAL NETWORK · {kind}{country&&<> · <span className="text-gold">{country}</span></>}</p><h1 className="mt-5 text-4xl sm:text-5xl">{name}</h1>{unverified&&<p className="mt-2 text-xs text-muted">Organization details have not been verified by Aluna.</p>}</div></div>
 {scores.length>0&&<div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{scores.map(score=><div key={score.label} className="rounded-2xl border border-line bg-panel-raised p-4"><p className="text-xs uppercase tracking-[.08em] text-muted">{score.label}</p><p className="mt-2 font-semibold text-gold">{score.value==null?'—':Number(score.value).toFixed(1)}</p></div>)}</div>}
 <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">{location&&<span>{location}</span>}{href&&<a className="text-gold hover:underline" href={href} target="_blank" rel="noopener noreferrer">Website ↗</a>}{editHref&&<Link className="ml-auto rounded-lg border border-gold px-4 py-2 text-gold hover:bg-gold/10" href={editHref}>Edit profile</Link>}</div></header>;
}
