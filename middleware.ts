import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '@/lib/supabase/proxy';
export function middleware(request: NextRequest) { if(request.nextUrl.pathname==='/api/stripe/webhook')return NextResponse.next();return refreshSession(request); }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
