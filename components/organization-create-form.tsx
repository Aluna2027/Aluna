'use client';
import { useState } from 'react';
import { createOrganization } from '@/app/(app)/organizations/actions';
import { countryGroups } from '@/lib/countries';
type OrgType='university'|'ngo'|'company';
const labels={university:'University',ngo:'NGO',company:'Company'} as const;

export function OrganizationCreateForm({initialType,error}:{initialType?:OrgType;error?:string}){
 const [type,setType]=useState<OrgType>(initialType??'university'),fixed=!!initialType;
 return <form action={createOrganization} encType="multipart/form-data" className="max-w-2xl space-y-5">
  {error&&<p role="alert" className="text-amber-300">{error==='validation'?'Check the fields, country and logo file.':'Could not create the organization.'}</p>}
  <label className="block text-sm">Country<select name="country" required defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="" disabled>Select a country</option>{countryGroups.map(group=><optgroup key={group.letter} label={group.letter}>{group.countries.map(country=><option key={country} value={country}>{country}</option>)}</optgroup>)}</select></label>
  <label className="block text-sm">Organization type{fixed?<><input type="hidden" name="organization_type" value={type}/><div className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">{labels[type]}</div></>:<select name="organization_type" value={type} onChange={e=>setType(e.target.value as OrgType)} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="university">University</option><option value="ngo">NGO</option><option value="company">Company</option></select>}</label>
  <label className="block text-sm">Name<input name="name" required minLength={2} maxLength={160} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">About<textarea name="description" rows={5} maxLength={3000} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Logo {labels[type]}<input name="logo_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-line bg-panel-raised p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-navy"/></label>
  {type==='company'&&<p className="rounded-xl border border-line bg-panel-raised p-4 text-sm text-muted">Official WBA scores are managed by Aluna and cannot be submitted by organization representatives.</p>}
  <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Create profile</button>
 </form>;
}
