'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeUrl } from '@/lib/profiles';

export async function updateProfile(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const display_name=String(form.get('display_name')??'').trim();
 const bio=String(form.get('bio')??'').trim();
 const location_text=String(form.get('location_text')??'').trim();
 const website=String(form.get('website')??'').trim();
 const avatar_url=String(form.get('avatar_url')??'').trim();
 const skills=String(form.get('skills')??'').split(',').map(v=>v.trim()).filter(Boolean),interests=String(form.get('interests')??'').split(',').map(v=>v.trim()).filter(Boolean);
 if(display_name.length<1||display_name.length>120||bio.length>2000||location_text.length>160||website.length>300||(website&&!safeUrl(website))||avatar_url.length>500||(avatar_url&&!safeUrl(avatar_url))||skills.length>20||interests.length>20||[...skills,...interests].some(v=>v.length>80))redirect('/profile/edit?error=validation');
 const {error}=await client.from('profiles').update({display_name,bio:bio||null,location_text:location_text||null,website:website||null,avatar_url:avatar_url||null,skills,interests,updated_at:new Date().toISOString()}).eq('id',user.id);
 if(error)redirect('/profile/edit?error=save');
 revalidatePath('/profile');revalidatePath(`/people/${user.id}`);
 redirect('/profile?status=saved');
}
