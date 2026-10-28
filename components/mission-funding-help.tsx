'use client';
import { CircleHelp } from 'lucide-react';
import { useState } from 'react';

const example='Example: A mission costs €50,000 and €20,000 is already available. Its Budget is €50,000 and its Funding Goal is €30,000.';
export function MissionFundingHelp({kind}:{kind:'budget'|'funding'}) {
 const [open,setOpen]=useState(false);
 const budget=kind==='budget';
 return <span className="relative inline-flex align-middle">
  <button type="button" aria-label={budget?'Explain Budget':'Explain Funding Goal'} aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="inline-flex rounded-full p-1 text-[#26E7D4] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"><CircleHelp size={18}/></button>
  {open&&<span role="note" className="absolute left-0 top-full z-50 mt-2 block w-[min(290px,80vw)] rounded-xl border border-line bg-navy p-4 text-sm font-normal leading-relaxed text-ink shadow-xl">
   <strong className="block text-gold">{budget?'What is the Budget?':'What is the Funding Goal?'}</strong>
   <span className="mt-2 block">{budget?'The total estimated cost of completing the SDG Mission, including funding already available.':'The amount that still needs to be raised to finance the SDG Mission.'}</span>
   <span className="mt-2 block text-muted">{example}</span>
   <button type="button" onClick={()=>setOpen(false)} className="mt-3 block text-gold underline">Close</button>
  </span>}
 </span>;
}
