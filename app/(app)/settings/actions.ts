'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/payments';
export async function changeAccountEmail(form:FormData){
 const email=String(form.get('email')??'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)redirect('/settings?error=email');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {error}=await client.auth.updateUser({email},{emailRedirectTo:`${siteOrigin()}/auth/callback?flow=settings`});
 if(error)redirect('/settings?error=email');redirect('/settings?status=email');
}
export async function changeAccountPassword(form:FormData){
 const password=String(form.get('password')??'');if(password.length<12||password.length>128)redirect('/settings?error=password');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {error}=await client.auth.updateUser({password});if(error)redirect('/settings?error=password');
 redirect('/settings?status=password');
}
