import { createServerClient, type CookieOptions } from '@supabase/ssr';
type CookieUpdate = { name: string; value: string; options: CookieOptions };
import { NextRequest, NextResponse } from 'next/server';
import { supabaseConfig } from './config';
import { safeAuthDestination } from '@/lib/auth-next';
import { isOnboardingComplete } from '@/lib/onboarding';

export async function refreshSession(request: NextRequest) {
  if (request.nextUrl.pathname === '/') return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items: CookieUpdate[]) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user && !['/login','/forgot-password','/reset-password'].includes(request.nextUrl.pathname) && !request.nextUrl.pathname.startsWith('/auth/') && !request.nextUrl.pathname.startsWith('/f/') && !request.nextUrl.pathname.startsWith('/r/') && !request.nextUrl.pathname.startsWith('/c/') && !request.nextUrl.pathname.startsWith('/donate/thank-you') && request.nextUrl.pathname !== '/api/stripe/webhook') {
    const url = request.nextUrl.clone(); url.pathname = '/login';
    if (safeAuthDestination(request.nextUrl.pathname)!=='/feed') url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  // Auth.getUser() reads authoritative Auth user state, not merely local JWT claims.
  // Avoid a login/feed redirect loop for suspended accounts.
  if (user?.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    if (request.nextUrl.pathname === '/login') return response;
    const login = new URL('/login?error=suspended', request.url);
    return NextResponse.redirect(login);
  }
  // Preserve the recipient-bound invitation while requiring personal onboarding.
  // The generic authenticated layout otherwise redirects to /onboarding and loses the token path.
  if(user && /^\/organizations\/invite\/[0-9a-f]{64}$/i.test(request.nextUrl.pathname)){
    const {data:profile}=await client.from('profiles')
      .select('display_name,first_name,last_name,onboarded_at,aluna_role')
      .eq('id',user.id).maybeSingle();
    if(!isOnboardingComplete(profile)){
      const destination=new URL('/onboarding',request.url);
      destination.searchParams.set('next',request.nextUrl.pathname);
      return NextResponse.redirect(destination);
    }
  }
  if (user && request.nextUrl.pathname === '/login') {
    const next=request.nextUrl.searchParams.get('next')??'';
    const safeNext=safeAuthDestination(next);
    const {data:profile}=await client.from('profiles').select('display_name,first_name,last_name,onboarded_at,aluna_role').eq('id',user.id).maybeSingle();
    if(!isOnboardingComplete(profile))return NextResponse.redirect(new URL('/onboarding'+(safeNext==='/feed'?'':'?next='+encodeURIComponent(safeNext)), request.url));
    return NextResponse.redirect(new URL(safeNext, request.url));
  }
  return response;
}
