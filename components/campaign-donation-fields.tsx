'use client';
import { useState } from 'react';
import { LockKeyhole, ShieldCheck, HeartHandshake, Check } from 'lucide-react';
import { startDonation } from '@/app/donate/actions';

export function CampaignDonationFields({campaignId,currency,requestKey}:{campaignId:string;currency:string;requestKey:string}){
 const [amount,setAmount]=useState('25');
 const [frequency,setFrequency]=useState('once');
 const [kind,setKind]=useState('standard');
 const [donorKind,setDonorKind]=useState('individual');
 const [anonymous,setAnonymous]=useState(false);
 const symbol=currency==='EUR'?'€':currency==='GBP'?'£':'$';
 const radio=(field:string,value:string,label:string,selected:string,update:(v:string)=>void)=>(
  <label className="inline-flex cursor-pointer items-center gap-2 text-sm sm:text-base">
   <input type="radio" name={field} value={value} checked={selected===value} onChange={()=>update(value)} className="size-4 accent-[#26E7D4]"/>
   <span className={selected===value?'text-[#26E7D4]':'text-muted'}>{label}</span>
  </label>
 );
 return <section className="rounded-[20px] border border-line bg-panel p-[18px] sm:p-5">
  <header className="flex items-center gap-3"><HeartHandshake size={25} color="#FF4FD8"/><h2 className="text-[20px] font-bold uppercase text-ink [font-stretch:normal] sm:text-[23px]">SUPPORT THIS MISSION</h2></header>
  <form action={startDonation} className="mt-7 space-y-6 border-t border-line pt-7">
   <input type="hidden" name="request_key" value={requestKey}/><input type="hidden" name="campaign_id" value={campaignId}/>
   <fieldset><legend className="mb-4 text-base font-semibold text-ink">Amount ({currency})</legend>
    <div className="grid grid-cols-3 gap-3">{['10','25','50','100','custom'].map(v=><label key={v} className={'flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-base font-semibold '+(amount===v?'border-[#FF4FD8] bg-[#342538] text-[#FF4FD8]':'border-line bg-input text-ink')}><input type="radio" className="sr-only" name="amount_choice" value={v} checked={amount===v} onChange={()=>setAmount(v)}/>{v==='custom'?'Custom':symbol+v}</label>)}</div>
    {amount==='custom'&&<label className="mt-4 block text-sm text-ink">Custom amount<input type="number" name="custom_amount" min="1" max="100000" step="0.01" required placeholder={'Amount in '+currency} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>}
   </fieldset>
   <fieldset className="border-t border-line pt-5"><legend className="text-base font-semibold text-ink">Frequency</legend><div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 sm:flex-col">{radio('frequency','once','One-time',frequency,setFrequency)}{radio('frequency','monthly','Monthly recurring',frequency,setFrequency)}</div></fieldset>
   <fieldset className="border-t border-line pt-5"><legend className="text-base font-semibold text-ink">Support type</legend><div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 sm:flex-col">{radio('donation_kind','standard','Donation',kind,setKind)}{radio('donation_kind','sponsorship','Mission sponsorship',kind,setKind)}</div></fieldset>
   <fieldset className="border-t border-line pt-5"><legend className="text-base font-semibold text-ink">Donor type</legend><div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 sm:flex-col">{radio('donor_kind','individual','Individual',donorKind,setDonorKind)}{radio('donor_kind','company','Company',donorKind,setDonorKind)}</div>
    {donorKind==='company'&&<label className="mt-4 block text-sm text-ink">Company name<input name="company_name" required minLength={2} maxLength={180} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>}
   </fieldset>
   <div className="border-t border-line pt-5"><label className="flex cursor-pointer items-center gap-3 text-sm text-ink"><input type="checkbox" name="anonymous" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)} className="size-4 accent-[#26E7D4]"/>Keep my name private on Aluna</label>
    <p className="mt-4 text-xs leading-relaxed text-muted">Stripe still collects payment and receipt details.</p>
    <p className="mt-3 text-xs leading-relaxed text-muted">Choose 1–100,000 {currency}. Mission sponsorship starts at 100. Monthly gifts renew until cancelled in Stripe.</p>
   </div>
   <button type="submit" className="flex min-h-[74px] w-full items-center justify-center gap-3 rounded-xl bg-gold px-4 text-base font-semibold text-navy"><LockKeyhole size={20}/>Continue to secure checkout</button>
   <p className="flex items-center justify-center gap-2 text-xs text-muted"><ShieldCheck size={18} color="#26E7D4"/>Secure checkout by Stripe</p>
  </form>
 </section>;
}
