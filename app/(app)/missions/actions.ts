'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { participationOptions } from '@/lib/missions';
import { countrySet } from '@/lib/countries';
function amount(form:FormData,key:string){const raw=String(form.get(key)??'').trim();if(!raw)return null;const n=Number(raw);if(!/^\d+(\.\d{1,2})?$/.test(raw)||!Number.isFinite(n)||n>999_999_999_999.99)throw new Error('Invalid amount');return n;}
function date(form:FormData,key:string){const v=String(form.get(key)??'').trim();if(!v)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v)))throw new Error('Invalid date');return v;}
function common(form:FormData){
 const title=String(form.get('title')??'').trim(),overview=String(form.get('overview')??'').trim(),location=String(form.get('location')??'').trim(),goal=String(form.get('goal')??'').trim(),roles=String(form.get('roles_summary')??'').trim();
 const start=date(form,'starts_on'),end=date(form,'ends_on'),budget=amount(form,'budget_amount'),funding=amount(form,'funding_goal_amount');
 const currency=String(form.get('currency_code')??'EUR');
 if(title.length<3||title.length>180||overview.length<10||overview.length>5000||location.length<2||location.length>240||goal.length<3||goal.length>2000||roles.length>2000||(start&&end&&end<start)||!['EUR','USD','GBP'].includes(currency))throw new Error('Invalid details');
 return {title,overview,location,goal,roles,start,end,budget,funding,currency};
}
export async function createMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 let fields:ReturnType<typeof common>;try{fields=common(form);}catch{redirect('/missions/new?error=validation');}
 const citySource=String(form.get('city')??'').trim(),manualPlace=String(form.get('manual_place')??'').trim(),manualCountry=String(form.get('manual_country')??'').trim();
 if((citySource&&manualPlace)||(citySource&&manualCountry)||(!citySource&&!manualPlace&&!manualCountry)||(!citySource&&(!manualPlace||!manualCountry))||manualPlace.length>160||(manualCountry&&!countrySet.has(manualCountry)))redirect('/missions/new?error=location');
 const {data:city}=citySource?await client.from('places').select('id').eq('source_key',citySource).maybeSingle():{data:null};if(citySource&&!city)redirect('/missions/new?error=city');
 const community=String(form.get('community_id')??'')||null,actor=String(form.get('actor_id')??'');
 if(community&&!city)redirect('/missions/new?error=community');
 const {data:id,error}=await client.rpc('create_mission_v2',{p_city:city?.id??null,p_manual_place:manualPlace||null,p_manual_country:manualCountry||null,p_community:community,p_actor:actor,p_title:fields.title,p_overview:fields.overview,p_location:fields.location,p_goal:fields.goal,p_roles:fields.roles||null,p_start:fields.start,p_end:fields.end,p_budget:fields.budget,p_funding:fields.funding,p_currency:fields.currency});
 if(error||!id)redirect('/missions/new?error=save');revalidatePath('/missions');redirect(`/missions/${id}`);
}
export async function updateMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/missions');
 let fields:ReturnType<typeof common>;try{fields=common(form);}catch{redirect(`/missions/${id}/edit?error=validation`);}
 const {error}=await client.from('missions').update({title:fields.title,overview:fields.overview,location_text:fields.location,goal:fields.goal,roles_summary:fields.roles||null,starts_on:fields.start,ends_on:fields.end,budget_amount:fields.budget,funding_goal_amount:fields.funding,currency_code:fields.currency,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)redirect(`/missions/${id}/edit?error=save`);revalidatePath('/missions');revalidatePath(`/missions/${id}`);redirect(`/missions/${id}?status=saved`);
}
export async function joinMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('mission_id')??''),actor_id=String(form.get('actor_id')??''),kind=String(form.get('participation_kind')??'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!participationOptions.some(option=>option.value===kind))redirect('/missions');
 const {error}=await client.from('mission_participations').insert({mission_id:id,actor_id,participation_kind:kind});
 if(error)redirect(`/missions/${id}?tab=participants&error=join`);revalidatePath(`/missions/${id}`);redirect(`/missions/${id}?tab=participants`);
}
export async function leaveMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('mission_id')??''),actor_id=String(form.get('actor_id')??''),kind=String(form.get('participation_kind')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/missions');
 const {error}=await client.from('mission_participations').delete().eq('mission_id',id).eq('actor_id',actor_id).eq('participation_kind',kind);
 if(error)redirect(`/missions/${id}?tab=participants&error=leave`);revalidatePath(`/missions/${id}`);redirect(`/missions/${id}?tab=participants`);
}
