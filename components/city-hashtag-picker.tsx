'use client';
import {useEffect,useMemo,useState} from 'react';
import {extractCityHashtags,type CityHashtagOptions,type CityHashtagRefs} from '@/lib/city-hashtags';

export function CityHashtagPicker({body,value,onChange}:{body:string;value:CityHashtagRefs;onChange:(value:CityHashtagRefs)=>void}){
 const tags=useMemo(()=>extractCityHashtags(body),[body]);
 const [options,setOptions]=useState<CityHashtagOptions>({});
 const key=tags.join(',');
 useEffect(()=>{
  let active=true;
  if(!key){setOptions({});return()=>{active=false;};}
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try{const response=await fetch(`/api/city-hashtag-options?tags=${encodeURIComponent(key)}`,{signal:controller.signal});if(!response.ok)return;const result=await response.json() as {options?:CityHashtagOptions};if(active)setOptions(result.options??{});}catch{}
  },250);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[key]);
 if(!tags.length)return null;
 return <fieldset className="mt-3 space-y-2 rounded-lg border border-line p-3"><legend className="px-1 text-xs font-semibold text-muted">City hashtag</legend>{tags.map(tag=>{
  const selected=value[tag]??'';const choices=options[tag]??[];
  return <label key={tag} className="flex flex-wrap items-center gap-2 text-sm"><span className="text-ink">#{tag}</span><select aria-label={`Associate hashtag ${tag} with a city`} value={selected} onChange={event=>onChange({...value,[tag]:event.target.value})} className="min-w-0 flex-1 rounded-lg border border-line bg-panel p-2 text-ink"><option value="">Choose city or first name</option>{choices.map(city=><option key={city.id} value={city.id}>{city.label}</option>)}<option value="__first_name__">First name — no city association</option></select></label>;
 })}</fieldset>;
}
