'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { participationOptions } from '@/lib/missions';
import { countrySet } from '@/lib/countries';
import { ownedActors } from '@/lib/social';
function amount(form:FormData,key:string){const raw=String(form.get(key)??'').trim();if(!raw)return null;const n=Number(raw);if(!/^\d+(\.\d{1,2})?$/.test(raw)||!Number.isFinite(n)||n>999_999_999_999.99)throw new Error('Invalid amount');return n;}
function date(form:FormData,key:string){const v=String(form.get(key)??'').trim();if(!v)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v)))throw new Error('Invalid date');return v;}
function selectedSdgs(form:FormData){const values=form.getAll('sdg_numbers').map(v=>Number(String(v))).filter(Number.isInteger);const unique=[...new Set(values)];if(!unique.length||unique.some(n=>n<1||n>17))throw new Error('Invalid SDGs');return unique;}
function common(form:FormData){
 const title=String(form.get('title')??'').trim(),overview=String(form.get('overview')??'').trim(),location=String(form.get('location')??'').trim(),goal=String(form.get('goal')??'').trim(),roles=String(form.get('roles_summary')??'').trim();
 const start=date(form,'starts_on'),end=date(form,'ends_on'),budget=amount(form,'budget_amount'),funding=amount(form,'funding_goal_amount');
 const currency=String(form.get('currency_code')??'EUR');
 if(title.length<3||title.length>180||overview.length<10||overview.length>5000||location.length<2||location.length>240||goal.length<3||goal.length>2000||roles.length<1||roles.length>2000||!start||!end||end<start||budget===null||funding===null||funding<=0||!['EUR','USD','GBP'].includes(currency))throw new Error('Invalid details');
 return {title,overview,location,goal,roles,start,end,budget,funding,currency};
}
export async function createMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 let fields:ReturnType<typeof common>;let sdgNumbers:number[];try{fields=common(form);sdgNumbers=selectedSdgs(form);}catch{redirect('/missions/new?error=validation');}
 const citySource=String(form.get('city')??'').trim(),manualPlace=String(form.get('manual_place')??'').trim(),manualCountry=String(form.get('manual_country')??'').trim();
 if((citySource&&manualPlace)||(citySource&&manualCountry)||(!citySource&&!manualPlace&&!manualCountry)||(!citySource&&(!manualPlace||!manualCountry))||manualPlace.length>160||(manualCountry&&!countrySet.has(manualCountry)))redirect('/missions/new?error=location');
 const {data:city}=citySource?await client.from('places').select('id').eq('source_key',citySource).maybeSingle():{data:null};if(citySource&&!city)redirect('/missions/new?error=city');
 const community=String(form.get('community_id')??'')||null,actor=String(form.get('actor_id')??'');
 if(community&&!city)redirect('/missions/new?error=community');
 const {data:id,error}=await client.rpc('create_mission_v3',{p_city:city?.id??null,p_manual_place:manualPlace||null,p_manual_country:manualCountry||null,p_community:community,p_actor:actor,p_title:fields.title,p_overview:fields.overview,p_location:fields.location,p_goal:fields.goal,p_sdgs:sdgNumbers,p_roles:fields.roles||null,p_start:fields.start,p_end:fields.end,p_budget:fields.budget,p_funding:fields.funding,p_currency:fields.currency});
 if(error||!id)redirect('/missions/new?error=save');const org=String(form.get('organization_id')??'');if(org&&/^[0-9a-f-]{36}$/i.test(org)){const {data:owner}=await client.from('actors').select('organization_id').eq('id',actor).maybeSingle();if(owner?.organization_id===org){revalidatePath(`/organizations/${org}`);revalidatePath('/missions');redirect(`/organizations/${org}?tab=missions&manage=1`);}}
 revalidatePath('/missions');redirect(`/missions/${id}`);
}
export async function updateMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/missions');
 let fields:ReturnType<typeof common>;let sdgNumbers:number[];try{fields=common(form);sdgNumbers=selectedSdgs(form);}catch{redirect(`/missions/${id}/edit?error=validation`);}
 const {error}=await client.rpc('update_mission_v2',{p_mission:id,p_title:fields.title,p_overview:fields.overview,p_location:fields.location,p_goal:fields.goal,p_sdgs:sdgNumbers,p_roles:fields.roles||null,p_start:fields.start,p_end:fields.end,p_budget:fields.budget,p_funding:fields.funding,p_currency:fields.currency});
 if(error)redirect(`/missions/${id}/edit?error=save`);
 revalidatePath('/missions');revalidatePath(`/missions/${id}`);revalidatePath('/fundraising');redirect(`/missions/${id}?status=saved`);
}
export async function joinMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('mission_id')??''),actor=String(form.get('actor_id')??'');
 const kinds=[...new Set(form.getAll('participation_kind').map(value=>String(value)))];
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(id)||!uuid.test(actor)||!kinds.length||kinds.some(kind=>!participationOptions.some(option=>option.value===kind)))redirect(`/missions/${id}?tab=participants&error=join`);
 const owned=await ownedActors();if(!owned.some(a=>a.id===actor))redirect(`/missions/${id}?tab=participants&error=join`);
 const {data:mission,error:missionError}=await client.from('missions').select('id').eq('id',id).is('removed_at',null).maybeSingle();
 if(missionError||!mission)redirect('/missions');
 const {data:existing,error:existingError}=await client.from('mission_participations').select('participation_kind').eq('mission_id',id).eq('actor_id',actor);
 if(existingError)redirect(`/missions/${id}?tab=participants&error=join`);
 const current=new Set((existing??[]).map(p=>p.participation_kind));
 const missing=kinds.filter(kind=>!current.has(kind));
 if(!missing.length)redirect(`/missions/${id}?tab=participants&status=already-joined`);
 const {error}=await client.from('mission_participations').insert(missing.map(participation_kind=>({mission_id:id,actor_id:actor,participation_kind})));
 if(error)redirect(`/missions/${id}?tab=participants&error=join`);
 revalidatePath('/missions');revalidatePath(`/missions/${id}`);
 redirect(`/missions/${id}?tab=participants&status=joined`);
}

export async function leaveMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('mission_id')??''),actor_id=String(form.get('actor_id')??''),kind=String(form.get('participation_kind')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/missions');
 const {error}=await client.from('mission_participations').delete().eq('mission_id',id).eq('actor_id',actor_id).eq('participation_kind',kind);
 if(error)redirect(`/missions/${id}?tab=participants&error=leave`);revalidatePath(`/missions/${id}`);redirect(`/missions/${id}?tab=participants`);
}


export async function removeMission(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/missions');
 const {error}=await client.rpc('remove_mission',{p_mission:id});
 if(error)redirect(`/missions/${id}?error=delete`);
 revalidatePath('/missions');revalidatePath('/fundraising');redirect('/missions');
}

export async function joinMissionFromDirectory(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('mission_id')??''),actor=String(form.get('actor_id')??'');
 const kinds=[...new Set(form.getAll('participation_kind').map(v=>String(v)))];
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(id)||!uuid.test(actor)||!kinds.length||kinds.some(k=>!participationOptions.some(o=>o.value===k)))redirect('/missions?error=join');
 const owned=await ownedActors();if(!owned.some(a=>a.id===actor))redirect('/missions?error=join');
 const {data:mission,error:missionError}=await client.from('missions').select('id').eq('id',id).is('removed_at',null).maybeSingle();
 if(missionError||!mission)redirect('/missions?error=join');
 const {data:existing,error:existingError}=await client.from('mission_participations').select('participation_kind').eq('mission_id',id).eq('actor_id',actor);
 if(existingError)redirect('/missions?error=join');
 const current=new Set((existing??[]).map(p=>p.participation_kind));
 const missing=kinds.filter(k=>!current.has(k));
 if(missing.length){
  const {error}=await client.from('mission_participations').insert(missing.map(k=>({mission_id:id,actor_id:actor,participation_kind:k})));
  if(error)redirect('/missions?error=join');
 }
 revalidatePath('/missions');revalidatePath(`/missions/${id}`);
 redirect('/missions?view=participating&status=joined');
}

function missionParticipationReturn(form:FormData,id:string){
 const detail=`/missions/${id}?tab=overview`;
 return String(form.get('return_to')??'')===detail?detail:'/missions';
}
function missionParticipationResult(base:string,result:string){
 return `${base}${base.includes('?')?'&':'?'}${result}`;
}

const directoryMissionUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Replace only this owned actor's selection; never touch another actor's participation. */
export async function saveMissionParticipationFromDirectory(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('mission_id')??''),actor=String(form.get('actor_id')??'');
 const kinds=[...new Set(form.getAll('participation_kind').map(v=>String(v)))];
 const destination=missionParticipationReturn(form,id);
 if(!directoryMissionUuid.test(id)||!directoryMissionUuid.test(actor)||!kinds.length||kinds.some(k=>!participationOptions.some(o=>o.value===k)))redirect(missionParticipationResult(destination,'error=participation'));
 const owned=await ownedActors();if(!owned.some(a=>a.id===actor))redirect(missionParticipationResult(destination,'error=participation'));
 const {data:mission,error:missionError}=await client.from('missions').select('id').eq('id',id).is('removed_at',null).maybeSingle();
 if(missionError||!mission)redirect(missionParticipationResult(destination,'error=participation'));
 const {data:existing,error:loadError}=await client.from('mission_participations').select('participation_kind').eq('mission_id',id).eq('actor_id',actor);
 if(loadError)redirect(missionParticipationResult(destination,'error=participation'));
 const prior=new Set((existing??[]).map(p=>p.participation_kind));
 const toAdd=kinds.filter(k=>!prior.has(k)),toRemove=[...prior].filter(k=>!kinds.includes(k));
 if(toAdd.length){
  const {error}=await client.from('mission_participations').insert(toAdd.map(participation_kind=>({mission_id:id,actor_id:actor,participation_kind})));
  if(error)redirect(missionParticipationResult(destination,'error=participation'));
 }
 if(toRemove.length){
  const {error}=await client.from('mission_participations').delete().eq('mission_id',id).eq('actor_id',actor).in('participation_kind',toRemove);
  if(error)redirect(missionParticipationResult(destination,'error=participation'));
 }
 revalidatePath('/missions');revalidatePath(`/missions/${id}`);
 redirect(missionParticipationResult(destination,'status=joined'));
}

export async function leaveMissionFromDirectory(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('mission_id')??''),actor=String(form.get('actor_id')??'');
 const destination=missionParticipationReturn(form,id);
 if(!directoryMissionUuid.test(id)||!directoryMissionUuid.test(actor))redirect(missionParticipationResult(destination,'error=leave'));
 const owned=await ownedActors();if(!owned.some(a=>a.id===actor))redirect(missionParticipationResult(destination,'error=leave'));
 const {error}=await client.from('mission_participations').delete().eq('mission_id',id).eq('actor_id',actor);
 if(error)redirect(missionParticipationResult(destination,'error=leave'));
 revalidatePath('/missions');revalidatePath(`/missions/${id}`);
 redirect(missionParticipationResult(destination,'status=left'));
}
