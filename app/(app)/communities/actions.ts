'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createCommunity(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const name=String(form.get('name')??'').trim(),location=String(form.get('location')??'').trim(),description=String(form.get('description')??'').trim();
 const citySource=String(form.get('city')??''),actor=String(form.get('actor_id')??'');
 if(name.length<2||name.length>160||location.length<2||location.length>240||description.length>3000)redirect('/communities/new?error=validation');
 const {data:city}=await client.from('places').select('id').eq('source_key',citySource).maybeSingle();if(!city)redirect('/communities/new?error=city');
 const {data:id,error}=await client.rpc('create_mesh_community',{p_city:city.id,p_name:name,p_location:location,p_actor:actor,p_description:description||null});
 if(error||!id)redirect('/communities/new?error=save');
 revalidatePath('/communities');revalidatePath(`/cities/${citySource}`);redirect(`/communities/${id}`);
}
function optionalCount(form:FormData,key:string){const text=String(form.get(key)??'').trim();if(!text)return null;const count=Number(text);if(!Number.isSafeInteger(count)||count<0||count>2_147_483_647)throw new Error('Invalid count');return count;}
export async function updateCommunity(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/communities');
 const name=String(form.get('name')??'').trim(),location_text=String(form.get('location')??'').trim(),description=String(form.get('description')??'').trim();
 if(name.length<2||name.length>160||location_text.length<2||location_text.length>240||description.length>3000)redirect(`/communities/${id}/edit?error=validation`);
 let population,people_connected,nodes,local_owners;
 try {population=optionalCount(form,'population');people_connected=optionalCount(form,'people_connected');nodes=optionalCount(form,'nodes');local_owners=optionalCount(form,'local_owners');}catch{redirect(`/communities/${id}/edit?error=validation`);}
 if(population!==null&&people_connected!==null&&people_connected>population)redirect(`/communities/${id}/edit?error=validation`);
 const {error}=await client.from('mesh_communities').update({name,location_text,description:description||null,population,people_connected,nodes,local_owners,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)redirect(`/communities/${id}/edit?error=save`);
 revalidatePath('/communities');revalidatePath(`/communities/${id}`);redirect(`/communities/${id}?status=saved`);
}
export async function joinCommunity(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('community_id')??''),actor_id=String(form.get('actor_id')??'');
 if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/communities');
 const {error}=await client.from('mesh_community_members').insert({community_id:id,actor_id,member_role:'member'});
 if(error)redirect(`/communities/${id}?error=join`);revalidatePath(`/communities/${id}`);redirect(`/communities/${id}?tab=members`);
}
export async function leaveCommunity(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('community_id')??''),actor_id=String(form.get('actor_id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/communities');
 const {error}=await client.from('mesh_community_members').delete().eq('community_id',id).eq('actor_id',actor_id).eq('member_role','member');
 if(error)redirect(`/communities/${id}?error=leave`);revalidatePath(`/communities/${id}`);redirect(`/communities/${id}?tab=members`);
}


export async function removeCommunity(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/communities');
 const {error}=await client.rpc('remove_mesh_community',{p_community:id});
 if(error)redirect(`/communities/${id}?error=delete`);
 revalidatePath('/communities');revalidatePath('/world-map');redirect('/communities');
}
