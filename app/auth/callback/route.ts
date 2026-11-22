import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeAuthDestination } from '@/lib/auth-next';
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/password-recovery';
import { issueRecoveryProof } from '@/lib/auth/recovery-proof';

function confirmationMessage(request: NextRequest) {
  const next=safeAuthDestination(request.nextUrl.searchParams.get('next')??'');
  const suffix=next==='/feed'?'':'&next='+encodeURIComponent(next);
  return NextResponse.redirect(new URL('/login?status=confirmation-link'+suffix, request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const flow = request.nextUrl.searchParams.get('flow');
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const isRecoveryFlow=flow==='recovery'||type==='recovery';
  const next=safeAuthDestination(request.nextUrl.searchParams.get('next')??'');
  const client = await createClient();
  const invalidRecovery = () => {
    const response=NextResponse.redirect(new URL('/reset-password?error=invalid',request.url));
    response.cookies.set(RECOVERY_COOKIE_NAME,'',{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:'/reset-password',maxAge:0});
    return response;
  };
  const validRecovery = (userId:string) => {
    const signingSecret=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!signingSecret)return invalidRecovery();
    const response=NextResponse.redirect(new URL('/reset-password',request.url));
    response.cookies.set(RECOVERY_COOKIE_NAME,issueRecoveryProof(userId,signingSecret),{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:'/reset-password',maxAge:600});
    response.headers.set('Cache-Control','private, no-store');
    return response;
  };
  async function onboardingDestination(){
    const {data:{user}}=await client.auth.getUser();
    const stored=safeAuthDestination(String(user?.user_metadata?.aluna_invitation_next??''));
    const destination=next!=='/feed'?next:stored;
    return destination==='/feed'?'/onboarding':'/onboarding?next='+encodeURIComponent(destination);
  }
 
  const isSignupFlow = flow === 'signup' || type === 'email' || type === 'signup';
  if (isSignupFlow) {
    await client.auth.signOut({ scope:'local' });
  }

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data:{ user } } = await client.auth.getUser();
      if(isRecoveryFlow)return user?validRecovery(user.id):invalidRecovery();
      if (!user) return confirmationMessage(request);
      return NextResponse.redirect(
        new URL(
          flow === 'recovery'
            ? '/reset-password'
            : flow === 'settings'
              ? '/dashboard'
              : await onboardingDestination(),
          request.url,
        ),
      );
    }

    if(isRecoveryFlow)return invalidRecovery();
    if (flow === 'signup') return confirmationMessage(request);
  }

  if (token && type === 'email') {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'email' });
    if (!error) {
      const { data:{ user } } = await client.auth.getUser();
      if (user) return NextResponse.redirect(new URL(flow === 'settings' ? '/dashboard' : await onboardingDestination(), request.url));
    }
    return confirmationMessage(request);
  }

  if (token && type === 'signup') {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'signup' });
    if (!error) {
      const { data:{ user } } = await client.auth.getUser();
      if (user) return NextResponse.redirect(new URL(await onboardingDestination(), request.url));
    }
    return confirmationMessage(request);
  }

  if (token && (isRecoveryFlow || flow === 'signup')) {
    const { error } = await client.auth.verifyOtp({
      token_hash: token,
      type: isRecoveryFlow ? 'recovery' : 'signup',
    });
    if (!error) {
      const { data:{ user } } = await client.auth.getUser();
      if (!user) return isRecoveryFlow ? invalidRecovery() : confirmationMessage(request);
      if(isRecoveryFlow)return validRecovery(user.id);
      return NextResponse.redirect(
        new URL(await onboardingDestination(), request.url),
      );
    }

    if(isRecoveryFlow)return invalidRecovery();
    if (flow === 'signup') return confirmationMessage(request);
  }

  if (isSignupFlow) {
    return confirmationMessage(request);
  }

  if(isRecoveryFlow)return invalidRecovery();
  return NextResponse.redirect(new URL('/login?error=invalid', request.url));
}
