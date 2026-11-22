'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeAuthDestination } from '@/lib/auth-next';
import { siteOrigin } from '@/lib/payments';
import { isOnboardingComplete, readOnboardingProfile } from '@/lib/onboarding';
import { clearRecoveryProofCookie, hasRecoveryProof, passwordRecoveryRedirectOrigin } from '@/lib/auth/password-recovery';
import { isTechnicalRecoveryRequestFailure, validateRecoveryPassword } from '@/lib/auth/recovery-proof';

export async function signIn(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  const next=String(form.get('next')??'');
  const safeNext=safeAuthDestination(next);
  if (error) redirect(`/login?error=invalid${safeNext!=='/feed'?`&next=${encodeURIComponent(safeNext)}`:''}`);
  const {data:{user}}=await client.auth.getUser();
  if(!user)redirect('/login?error=invalid');
  const {data:profile}=await readOnboardingProfile(client,user.id);
  // Signup email confirmation may return through a different browser or canonical domain.
  const storedNext=safeAuthDestination(String(user.user_metadata?.aluna_invitation_next??''));
  const destination=safeNext!=='/feed'?safeNext:storedNext;
  if(!isOnboardingComplete(profile))redirect('/onboarding'+(destination==='/feed'?'':'?next='+encodeURIComponent(destination)));
  redirect(destination);
}

export async function signUp(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirm_password') ?? '');
  const signupNext=safeAuthDestination(String(form.get('next')??''));
  const signupNextParam=signupNext==='/feed'?'':'&next='+encodeURIComponent(signupNext);
  if(password!==confirmPassword) redirect('/login?mode=signup&error=password-mismatch'+signupNextParam);

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128) {
    redirect('/login?mode=signup&error=validation'+signupNextParam);
  }

  const next=safeAuthDestination(String(form.get('next')??''));
  const nextParam=next==='/feed'?'':'&next='+encodeURIComponent(next);
  const client = await createClient();

  // A signup must never inherit an already authenticated browser session.
  await client.auth.signOut({ scope:'local' });

  const { error, data } = await client.auth.signUp({
    email,
    password,
    options:{emailRedirectTo:`${siteOrigin()}/auth/callback?flow=signup${nextParam}`,data:/^\/organizations\/invite\/[0-9a-f]{64}$/i.test(next)?{aluna_invitation_next:next}:{}}
  });

  if (error) {
    if (error.code === 'over_email_send_rate_limit') {
      redirect('/login?mode=signup&status=verification-recent'+nextParam);
    }
    redirect('/login?mode=signup&error=signup'+nextParam);
  }

  redirect(data.session ? '/onboarding'+(next==='/feed'?'':'?next='+encodeURIComponent(next)) : '/login?status=verify'+nextParam);
}

export async function requestPasswordReset(form:FormData){
 const email=String(form.get('email')??'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)redirect('/forgot-password?error=request');
 let result;
 try {
  const client=await createClient();
  result=await client.auth.resetPasswordForEmail(email,{redirectTo:`${passwordRecoveryRedirectOrigin()}/auth/callback?flow=recovery`});
 } catch {
  redirect('/forgot-password?error=request');
 }
 // Supabase can return 429 for address- or IP-based email throttling; keep those
 // indistinguishable from accepted requests to avoid account enumeration.
 // Other HTTP errors indicate technical/configuration failures; transport/server
 // failures use the same generic technical message.
 if(isTechnicalRecoveryRequestFailure(result.error))redirect('/forgot-password?error=request');
 redirect('/forgot-password?status=sent');
}

export async function resetPassword(form:FormData){
 const password=String(form.get('password')??'');
 const confirmPassword=String(form.get('confirm_password')??'');
 const validation=validateRecoveryPassword(password,confirmPassword);
 if(validation==='mismatch')redirect('/reset-password?error=mismatch');
 if(validation==='invalid-length')redirect('/reset-password?error=validation');
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user||!(await hasRecoveryProof(user.id))){await clearRecoveryProofCookie();redirect('/reset-password?error=invalid');}
 const {error}=await client.auth.updateUser({password});
 if(error)redirect('/reset-password?error=save');
 await client.auth.signOut({scope:'local'});
 await clearRecoveryProofCookie();
 redirect('/login?status=password-updated');
}

export async function signOut() {
  const client = await createClient();
  await client.auth.signOut();
  redirect('/login');
}
