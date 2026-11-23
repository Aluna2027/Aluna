import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cities } from '@/lib/cities';
import { extractCityHashtags, matchCityHashtagCandidates, normalizeCityHashtag } from '@/lib/city-hashtags';

export async function GET(request:Request) {
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const requested=new URL(request.url).searchParams.get('tags')??'';
 const tags=extractCityHashtags(requested.split(',').map(tag=>`#${tag}`).join(' '));
 if(!tags.length)return NextResponse.json({options:{}});
 const wanted=new Set(tags.map(normalizeCityHashtag));
 const matching=cities.filter(city=>{
  const key=normalizeCityHashtag(city.name);
  return key!==''&&wanted.has(key);
 });
 if(!matching.length)return NextResponse.json({options:Object.fromEntries(tags.map(tag=>[tag,[]]))});
 const {data,error}=await client.from('places').select('id,source_key').in('source_key',matching.map(city=>city.id));
 if(error)return NextResponse.json({error:'Unable to load city options'},{status:503});
 const idByKey=new Map((data??[]).map(place=>[place.source_key,place.id]));
 const options:Record<string,{id:string;name:string;country:string;region:string;label:string}[]>={};
 for(const tag of tags){
  const matches=matchCityHashtagCandidates(tag,matching);
  options[tag]=matches.flatMap(city=>{const id=idByKey.get(city.id);return id?[{id,name:city.name,country:city.country,region:city.region,label:`${city.name} — ${city.country}${city.region?`, ${city.region}`:''}`}]:[];});
 }
 return NextResponse.json({options});
}
