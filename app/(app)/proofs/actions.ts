'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { evidenceTypes } from '@/lib/proofs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function optionalId(form:FormData,key:string){const value=String(form.get(key)??'');if(value&&!uuid.test(value))throw Error('Invalid id');return value||null;}
export async function createProof(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 let args:{p_actor:string;p_contribution:string|null;p_post:string|null;p_mission:string|null;p_city:string|null;p_evidence_type:string;p_evidence_url:string|null;p_evidence_description:string;p_latitude:number|null;p_longitude:number|null;p_result:string;p_date:string};
 try{
  const actor=String(form.get('actor_id')??''),type=String(form.get('evidence_type')??'');const url=String(form.get('evidence_url')??'').trim();const description=String(form.get('evidence_description')??'').trim(),result=String(form.get('result_text')??'').trim(),date=String(form.get('occurred_on')??'');
  const lat=String(form.get('latitude')??'').trim(),lon=String(form.get('longitude')??'').trim();const nlat=lat?Number(lat):null,nlon=lon?Number(lon):null;
  const parsedDate=new Date(`${date}T00:00:00Z`);
  if(!uuid.test(actor)||!evidenceTypes.some(e=>e.value===type)||description.length<10||description.length>3000||result.length<10||result.length>3000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==date||url&&(!url.startsWith('https://')||url.length>2000)||((nlat===null)!==(nlon===null))||(type==='geolocation'&&nlat===null)||nlat!==null&&(!Number.isFinite(nlat)||nlat< -90||nlat>90)||nlon!==null&&(!Number.isFinite(nlon)||nlon< -180||nlon>180))throw Error('Invalid proof');
  args={p_actor:actor,p_contribution:optionalId(form,'contribution_id'),p_post:optionalId(form,'post_id'),p_mission:optionalId(form,'mission_id'),p_city:null,p_evidence_type:type,p_evidence_url:url||null,p_evidence_description:description,p_latitude:nlat,p_longitude:nlon,p_result:result,p_date:date};
  const cityKey=String(form.get('city')??'');if(cityKey){const {data}=await client.from('places').select('id').eq('source_key',cityKey).maybeSingle();if(!data)throw Error('Invalid city');args.p_city=data.id;}
  if(!args.p_contribution&&!args.p_post)throw Error('Missing source');
 }catch{redirect('/proofs/new?error=validation');}
 const {data:id,error}=await client.rpc('create_proof',args);if(error||!id)redirect('/proofs/new?error=save');
 revalidatePath('/proofs');redirect(`/proofs/${id}`);
}
export async function verifyProof(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('proof_id')??''),actor=String(form.get('actor_id')??''),expected=Number(form.get('expected_level')),next=Number(form.get('new_level')),reason=String(form.get('reason')??'').trim();
 if(!uuid.test(id)||!uuid.test(actor)||![1,2,3,4].includes(expected)||![1,2,3,4].includes(next)||reason.length<10||reason.length>2000)redirect('/proofs');
 const {error}=await client.rpc('change_proof_verification',{p_proof:id,p_actor:actor,p_expected:expected,p_new:next,p_reason:reason});
 if(error)redirect(`/proofs/${id}?error=review`);revalidatePath(`/proofs/${id}`);revalidatePath('/proofs');redirect(`/proofs/${id}?status=reviewed`);
}
