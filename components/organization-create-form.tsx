'use client';
import { useState } from 'react';
import { createOrganization } from '@/app/(app)/organizations/actions';
import { countryGroups } from '@/lib/countries';
type OrgType='university'|'ngo'|'company';
const labels={university:'University',ngo:'NGO',company:'Company'} as const;
const options=Array.from({length:101},(_,i)=>(i/10).toFixed(1));

export function OrganizationCreateForm({initialType,error}:{initialType?:OrgType;error?:string}){
 const [type,setType]=useState<OrgType>(initialType??'university'),fixed=!!initialType;
 return <form action={createOrganization} encType="multipart/form-data" className="max-w-2xl space-y-5">
  {error&&<p role="alert" className="text-amber-300">{error==='validation'?'Check the fields, country, score values and logo file.':'Could not create the organization.'}</p>}
  <label className="block text-sm">Country<select name="country" required defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="" disabled>Select a country</option>{countryGroups.map(group=><optgroup key={group.letter} label={group.letter}>{group.countries.map(country=><option key={country} value={country}>{country}</option>)}</optgroup>)}</select></label>
  <label className="block text-sm">Organization type{fixed?<><input type="hidden" name="organization_type" value={type}/><div className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">{labels[type]}</div></>:<select name="organization_type" value={type} onChange={e=>setType(e.target.value as OrgType)} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="university">University</option><option value="ngo">NGO</option><option value="company">Company</option></select>}</label>
  <label className="block text-sm">Name<input name="name" required minLength={2} maxLength={160} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">About<textarea name="description" rows={5} maxLength={3000} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Logo {labels[type]}<input name="logo_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-line bg-panel-raised p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-navy"/></label>
  {type==='company'&&<div className="space-y-5 rounded-2xl border border-line p-5">
   <div className="flex items-center gap-2"><p className="font-semibold">World Benchmarking Alliance Score</p><span className="group relative"><button type="button" aria-label="World Benchmarking Alliance score information" className="flex h-5 w-5 items-center justify-center rounded-full border border-gold text-xs text-gold">?</button><span className="invisible absolute left-0 top-7 z-20 w-72 rounded-xl border border-line bg-panel p-3 text-xs text-muted shadow-xl group-hover:visible group-focus-within:visible">As a multi-national you can find your World Benchmarking Alliance Score on: <a href="https://www.worldbenchmarkingalliance.org/benchmark/social-benchmark" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">World Benchmarking Alliance ↗</a></span></span></div>
   <label className="block text-sm">Total Score<input name="wba_total_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
   <label className="block text-sm">Respecting Human Rights<select name="wba_human_rights_score" defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">Select score</option>{options.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
   <label className="block text-sm">Providing and Promoting Decent Work<select name="wba_decent_work_score" defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">Select score</option>{options.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
   <label className="block text-sm">Acting Ethically<select name="wba_acting_ethically_score" defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">Select score</option>{options.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
  </div>}
  <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Create profile</button>
 </form>;
}
