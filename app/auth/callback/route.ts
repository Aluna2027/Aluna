import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const flow = request.nextUrl.searchParams.get('flow');
  const token = request.nextUrl.searchParams.get('token_hash');
  const client = await createClient();
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(flow==='recovery'?'/reset-password':flow==='settings'?'/settings':'/onboarding', request.url));
  }
  if(token && (flow==='recovery'||flow==='signup')){
    const {error}=await client.auth.verifyOtp({token_hash:token,type:flow==='recovery'?'recovery':'signup'});
    if(!error)return NextResponse.redirect(new URL(flow==='recovery'?'/reset-password':'/onboarding',request.url));
  }
  return NextResponse.redirect(new URL('/login?error=invalid', request.url));
}
