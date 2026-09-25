'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { safeUrl } from '@/lib/profiles';
function words(value:FormDataEntryValue|null){return String(value??'').split(',').map(s=>s.trim()).filter(Boolean);}
export async function completeOnboarding(form:FormData){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const name=String(form.get('name')??'').trim(),avatar=String(form.get('avatar')??'').trim(),location=String(form.get('location')??'').trim(),bio=String(form.get('bio')??'').trim(),skills=words(form.get('skills')),interests=words(form.get('interests'));
 if(!name||name.length>120||location.length>160||bio.length>2000||avatar.length>500||(avatar&&(!safeUrl(avatar)||!avatar.startsWith('https://')))||skills.length>20||interests.length>20||[...skills,...interests].some(x=>x.length>80))redirect('/onboarding?error=validation');
 const {error}=await client.rpc('complete_member_onboarding',{p_name:name,p_avatar:avatar,p_location:location,p_bio:bio,p_skills:skills,p_interests:interests});
 if(error)redirect('/onboarding?error=save');revalidatePath('/profile');redirect('/dashboard');
}
