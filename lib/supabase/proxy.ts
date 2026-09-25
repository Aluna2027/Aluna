import { createServerClient, type CookieOptions } from '@supabase/ssr';
type CookieUpdate = { name: string; value: string; options: CookieOptions };
import { NextRequest, NextResponse } from 'next/server';
import { supabaseConfig } from './config';
import { safeAuthDestination } from '@/lib/auth-next';

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
    if (safeAuthDestination(request.nextUrl.pathname)!=='/dashboard') url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === '/login') {
    const next=request.nextUrl.searchParams.get('next')??'';
    const safeNext=safeAuthDestination(next);
    return NextResponse.redirect(new URL(safeNext, request.url));
  }
  return response;
}
