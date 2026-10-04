'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeAuthDestination } from '@/lib/auth-next';
import { siteOrigin } from '@/lib/payments';

export async function signIn(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  const next=String(form.get('next')??'');
  const safeNext=safeAuthDestination(next);
  if (error) redirect(`/login?error=invalid${safeNext!=='/dashboard'?`&next=${encodeURIComponent(safeNext)}`:''}`);
  redirect(safeNext);
}

export async function signUp(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128) {
    redirect('/login?mode=signup&error=validation');
  }

  const client = await createClient();

  // A signup must never inherit an already authenticated browser session.
  await client.auth.signOut({ scope:'local' });

  const { error, data } = await client.auth.signUp({
    email,
    password,
    options:{emailRedirectTo:`${siteOrigin()}/auth/callback?flow=signup`}
  });

  if (error) {
    if (error.code === 'over_email_send_rate_limit') {
      redirect('/login?mode=signup&status=verification-recent');
    }
    redirect('/login?mode=signup&error=signup');
  }

  redirect(data.session ? '/onboarding' : '/login?status=verify');
}

export async function requestPasswordReset(form:FormData){
 const email=String(form.get('email')??'').trim();
 if(!email)redirect('/forgot-password?error=validation');
 const client=await createClient();
 await client.auth.resetPasswordForEmail(email,{redirectTo:`${siteOrigin()}/auth/callback?flow=recovery`});
 // Do not disclose whether an account exists for this email.
 redirect('/forgot-password?status=sent');
}

export async function resetPassword(form:FormData){
 const password=String(form.get('password')??'');
 if(password.length<12||password.length>128)redirect('/reset-password?error=validation');
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/forgot-password');
 const {error}=await client.auth.updateUser({password});
 if(error)redirect('/reset-password?error=save');
 await client.auth.signOut();
 redirect('/login?status=password-updated');
}

export async function signOut() {
  const client = await createClient();
  await client.auth.signOut();
  redirect('/login');
}
