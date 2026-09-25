'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { contributionTypes } from '@/lib/contributions';
import { createClient } from '@/lib/supabase/server';
export async function createContribution(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const actor_id=String(form.get('actor_id')??'');const contribution_type=String(form.get('contribution_type')??'');
 const title=String(form.get('title')??'').trim();const description=String(form.get('description')??'').trim();const contributed_on=String(form.get('contributed_on')??'');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const mission_id=String(form.get('mission_id')??'')||null,community_id=String(form.get('community_id')??'')||null,cityKey=String(form.get('city')??'');
 const date=new Date(`${contributed_on}T00:00:00Z`);
 if(!uuid.test(actor_id)||!contributionTypes.some(t=>t.value===contribution_type)||title.length<3||title.length>160||description.length<10||description.length>3000||!/^\d{4}-\d{2}-\d{2}$/.test(contributed_on)||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==contributed_on||(mission_id&&!uuid.test(mission_id))||(community_id&&!uuid.test(community_id)))redirect('/contributions/new?error=validation');
 let city_id:string|null=null;
 if(cityKey){const {data}=await client.from('places').select('id').eq('source_key',cityKey).maybeSingle();if(!data)redirect('/contributions/new?error=city');city_id=data.id;}
 const {data,error}=await client.from('contributions').insert({actor_id,contribution_type,title,description,contributed_on,mission_id,community_id,city_id}).select('id').single();
 if(error||!data)redirect('/contributions/new?error=save');
 revalidatePath('/contributions');redirect(`/contributions/${data.id}`);
}
