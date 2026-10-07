'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeUrl } from '@/lib/profiles';

const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif']);
const roles=new Set(['builder','explorer','rebel','creator']);
function ext(file:File){return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';}

export async function updateProfile(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const display_name=String(form.get('display_name')??'').trim();
 const first_name=String(form.get('first_name')??'').trim();
 const last_name=String(form.get('last_name')??'').trim();
 const date_of_birth=String(form.get('date_of_birth')??'').trim();
 const aluna_role=String(form.get('aluna_role')??'');
 const bio=String(form.get('bio')??'').trim();
 const location_text=String(form.get('location_text')??'').trim();
 const website=String(form.get('website')??'').trim();
 const skills=String(form.get('skills')??'').split(',').map(v=>v.trim()).filter(Boolean),interests=String(form.get('interests')??'').split(',').map(v=>v.trim()).filter(Boolean);
 const raw=form.get('avatar_file');const avatar=raw instanceof File&&raw.size>0?raw:null;
 const validBirth=!date_of_birth||(/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)&&!Number.isNaN(Date.parse(date_of_birth))&&date_of_birth<=new Date().toISOString().slice(0,10));
 if(display_name.length<1||display_name.length>120||first_name.length<1||first_name.length>80||last_name.length<1||last_name.length>80||!validBirth||!roles.has(aluna_role)||bio.length>2000||location_text.length>160||website.length>300||(website&&!safeUrl(website))||skills.length>20||interests.length>20||[...skills,...interests].some(v=>v.length>80)||!!avatar&&(!imageTypes.has(avatar.type)||avatar.size>5*1024*1024))redirect('/profile/edit?error=validation');
 let avatar_url:string|undefined;
 if(avatar){const path=`${user.id}/avatar-${crypto.randomUUID()}.${ext(avatar)}`;const {error}=await client.storage.from('profile-media').upload(path,avatar,{contentType:avatar.type});if(error)redirect('/profile/edit?error=save');avatar_url=client.storage.from('profile-media').getPublicUrl(path).data.publicUrl;}
 const update:{display_name:string;first_name:string;last_name:string;date_of_birth:string|null;aluna_role:string;bio:string|null;location_text:string|null;website:string|null;skills:string[];interests:string[];updated_at:string;avatar_url?:string}={display_name,first_name,last_name,date_of_birth:date_of_birth||null,aluna_role,bio:bio||null,location_text:location_text||null,website:website||null,skills,interests,updated_at:new Date().toISOString()};if(avatar_url)update.avatar_url=avatar_url;
 const {error}=await client.from('profiles').update(update).eq('id',user.id);if(error)redirect('/profile/edit?error=save');
 revalidatePath('/profile');revalidatePath(`/people/${user.id}`);redirect('/profile?status=saved');
}
