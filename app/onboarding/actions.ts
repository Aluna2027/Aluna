'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const roles=new Set(['builder','explorer','rebel','creator']);
const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif']);
function words(value:FormDataEntryValue|null){return String(value??'').split(',').map(s=>s.trim()).filter(Boolean);}
function ext(file:File){return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';}

export async function completeOnboarding(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const display_name=String(form.get('display_name')??'').trim(),first_name=String(form.get('first_name')??'').trim(),last_name=String(form.get('last_name')??'').trim(),location=String(form.get('location')??'').trim(),bio=String(form.get('bio')??'').trim(),skills=words(form.get('skills')),interests=words(form.get('interests')),aluna_role=String(form.get('aluna_role')??'');
 const raw=form.get('avatar_file');const avatar=raw instanceof File&&raw.size>0?raw:null;
 if(!display_name||display_name.length>120||!first_name||first_name.length>80||!last_name||last_name.length>80||!roles.has(aluna_role)||location.length>160||bio.length>2000||skills.length>20||interests.length>20||[...skills,...interests].some(x=>x.length>80)||!!avatar&&(!imageTypes.has(avatar.type)||avatar.size>5*1024*1024))redirect('/onboarding?error=validation');

 let avatarUrl='';
 if(avatar){
  const path=`${user.id}/avatar-${crypto.randomUUID()}.${ext(avatar)}`;
  const {error:uploadError}=await client.storage.from('profile-media').upload(path,avatar,{contentType:avatar.type});
  if(uploadError)redirect('/onboarding?error=save');
  avatarUrl=client.storage.from('profile-media').getPublicUrl(path).data.publicUrl;
 }

 const {error}=await client.rpc('complete_member_onboarding_v3',{p_display_name:display_name,p_first_name:first_name,p_last_name:last_name,p_avatar:avatarUrl,p_location:location,p_bio:bio,p_skills:skills,p_interests:interests,p_aluna_role:aluna_role});
 if(error)redirect('/onboarding?error=save');
 revalidatePath('/profile');
 redirect('/dashboard');
}
