'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {safeAuthDestination} from '@/lib/auth-next';

const roles=new Set(['builder','explorer','rebel','creator']);
const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif']);
function words(value:FormDataEntryValue|null){return String(value??'').split(',').map(s=>s.trim()).filter(Boolean);}
function ext(file:File){return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';}

export async function completeOnboarding(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const display_name=String(form.get('display_name')??'').trim(),first_name=String(form.get('first_name')??'').trim(),last_name=String(form.get('last_name')??'').trim(),location=String(form.get('location')??'').trim(),bio=String(form.get('bio')??'').trim(),skills=words(form.get('skills')),interests=words(form.get('interests')),aluna_role=String(form.get('aluna_role')??'');
 const dob=String(form.get('date_of_birth')??'').trim(),gender=String(form.get('gender')??'').trim();
 const validDob=!dob||(/^\d{4}-\d{2}-\d{2}$/.test(dob)&&!Number.isNaN(Date.parse(dob))&&new Date(dob).toISOString().slice(0,10)===dob&&dob<=new Date().toISOString().slice(0,10));
 const next=safeAuthDestination(String(form.get('next')??''));
 const retryNext=next==='/feed'?'':'&next='+encodeURIComponent(next);
 const raw=form.get('avatar_file');const avatar=raw instanceof File&&raw.size>0?raw:null;
 if(!validDob||!['','male','female','prefer_not_to_say'].includes(gender)||!display_name||display_name.length>120||!first_name||first_name.length>80||!last_name||last_name.length>80||!roles.has(aluna_role)||location.length>160||bio.length>2000||skills.length>20||interests.length>20||[...skills,...interests].some(x=>x.length>80)||!!avatar&&(!imageTypes.has(avatar.type)||avatar.size>5*1024*1024))redirect('/onboarding?error=validation'+retryNext);

 let avatarUrl='';
 if(avatar){
  const path=`${user.id}/avatar-${crypto.randomUUID()}.${ext(avatar)}`;
  const {error:uploadError}=await client.storage.from('profile-media').upload(path,avatar,{contentType:avatar.type});
  if(uploadError)redirect('/onboarding?error=save'+retryNext);
  avatarUrl=client.storage.from('profile-media').getPublicUrl(path).data.publicUrl;
 }

 const {error}=await client.rpc('complete_member_onboarding_v4',{p_display_name:display_name,p_first_name:first_name,p_last_name:last_name,p_avatar:avatarUrl,p_location:location,p_bio:bio,p_skills:skills,p_interests:interests,p_aluna_role:aluna_role,p_date_of_birth:dob||null,p_gender:gender||null});
 if(error)redirect('/onboarding?error=save');
 revalidatePath('/profile');
 redirect(next);
}
