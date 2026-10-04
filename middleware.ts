import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '@/lib/supabase/proxy';

function canonicalProductionRedirect(request:NextRequest){
 const raw=process.env.ALUNA_SITE_URL;
 if(!raw||process.env.VERCEL_ENV!=='production')return null;
 let canonical:URL;
 try{canonical=new URL(raw);}catch{return null;}
 const incomingHost=request.nextUrl.host.toLowerCase();
 const canonicalHost=canonical.host.toLowerCase();
 if(incomingHost===canonicalHost)return null;
 if(!incomingHost.endsWith('.vercel.app'))return null;
 const url=request.nextUrl.clone();
 url.protocol=canonical.protocol;
 url.host=canonical.host;
 return NextResponse.redirect(url,308);
}

export function middleware(request: NextRequest) {
 const canonical=canonicalProductionRedirect(request);
 if(canonical)return canonical;
 if(request.nextUrl.pathname==='/api/stripe/webhook')return NextResponse.next();
 return refreshSession(request);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
