'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/payments';

export async function changeAccountEmail(form:FormData){
 const email=String(form.get('email')??'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)redirect('/settings?error=email');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 if(user.email?.trim().toLowerCase()===email)redirect('/settings?error=email-current');
 const {error}=await client.auth.updateUser({email},{emailRedirectTo:`${siteOrigin()}/auth/callback?flow=settings`});
 if(error){
  if(error.code==='email_exists'||error.code==='user_already_exists'||error.code==='identity_already_exists')redirect('/settings?error=email-in-use');
  redirect('/settings?error=email');
 }
 redirect('/settings?status=email');
}

export async function changeAccountPassword(form:FormData){
 const password=String(form.get('password')??'');if(password.length<12||password.length>128)redirect('/settings?error=password');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {error}=await client.auth.updateUser({password});if(error)redirect('/settings?error=password');
 redirect('/settings?status=password');
}
