'use client';
import { useEffect,useState } from 'react';
import { cities } from '@/lib/cities';
import { countryGroups } from '@/lib/countries';
type Entry={id:string;name:string};
export function MissionCommunityLocation({defaultCity='',defaultCommunity='',defaultManual='',defaultCountry=''}:{defaultCity?:string;defaultCommunity?:string;defaultManual?:string;defaultCountry?:string}){
 const [city,setCity]=useState(defaultCity);
 const [manual,setManual]=useState(defaultManual);
 const [q,setQ]=useState('');
 const [community,setCommunity]=useState(defaultCommunity);
 const [items,setItems]=useState<Entry[]>([]);
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!city||manual.trim()){setItems([]);setCommunity('');return;}
  let active=true;const c=new AbortController();setLoading(true);
  const timer=setTimeout(()=>{
   fetch(`/api/mission-communities?city=${encodeURIComponent(city)}&q=${encodeURIComponent(q)}`,{signal:c.signal})
    .then(r=>r.ok?r.json():{items:[]}).then(v=>{if(active)setItems((v.items??[]) as Entry[])})
    .catch(()=>{if(active)setItems([])}).finally(()=>{if(active)setLoading(false)});
  },250);
  return()=>{active=false;c.abort();clearTimeout(timer)};
 },[city,manual,q]);
 return <>
  <label className="block text-sm">City<select name="city" value={manual.trim()?'':city} onChange={e=>{setCity(e.target.value);setCommunity('');setQ('')}} disabled={Boolean(manual.trim())} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">Select a city</option>{[...cities].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}, {c.country}</option>)}</select></label>
  <p className="text-sm text-white">Or type a city or village and select the country it is in.</p>
  <label className="block text-sm">City or village<input name="manual_place" value={manual} maxLength={160} onChange={e=>{setManual(e.target.value);if(e.target.value.trim()){setCity('');setCommunity('')}}} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Country<select name="manual_country" defaultValue={defaultCountry} required={Boolean(manual.trim())} disabled={Boolean(city)} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">Select a country</option>{countryGroups.map(g=><optgroup key={g.letter} label={g.letter}>{g.countries.map(country=><option key={country} value={country}>{country}</option>)}</optgroup>)}</select></label>
  <div className="space-y-2"><label className="block text-sm">Wi-Fi Mesh Community (optional)</label>
   <input type="search" placeholder="Search communities in the selected city" value={q} onChange={e=>{setQ(e.target.value);setCommunity('')}} disabled={!city||Boolean(manual.trim())} className="w-full rounded-xl border border-line bg-panel-raised p-3"/>
   <select name="community_id" value={community} onChange={e=>setCommunity(e.target.value)} disabled={!city||Boolean(manual.trim())} className="w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">No linked community</option>{items.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
   <p className="text-xs text-muted">{loading?'Searching...':city?'Showing up to 25 matching communities. Refine your search if needed.':'Select a city to link a community. Manual village locations do not link communities.'}</p>
  </div>
 </>;
}
