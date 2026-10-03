import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function confirmationMessage(request: NextRequest) {
  return NextResponse.redirect(new URL('/login?status=confirmation-link', request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const flow = request.nextUrl.searchParams.get('flow');
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const client = await createClient();

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(
          flow === 'recovery'
            ? '/reset-password'
            : flow === 'settings'
              ? '/settings'
              : '/onboarding',
          request.url,
        ),
      );
    }

    if (flow === 'signup') return confirmationMessage(request);
  }

  if (token && type === 'email') {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'email' });
    if (!error) return NextResponse.redirect(new URL('/onboarding', request.url));
    return confirmationMessage(request);
  }

  if (token && type === 'signup') {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'signup' });
    if (!error) return NextResponse.redirect(new URL('/onboarding', request.url));
    return confirmationMessage(request);
  }

  if (token && (flow === 'recovery' || flow === 'signup')) {
    const { error } = await client.auth.verifyOtp({
      token_hash: token,
      type: flow === 'recovery' ? 'recovery' : 'signup',
    });
    if (!error) {
      return NextResponse.redirect(
        new URL(flow === 'recovery' ? '/reset-password' : '/onboarding', request.url),
      );
    }

    if (flow === 'signup') return confirmationMessage(request);
  }

  if (flow === 'signup' || type === 'email' || type === 'signup') {
    return confirmationMessage(request);
  }

  return NextResponse.redirect(new URL('/login?error=invalid', request.url));
}
