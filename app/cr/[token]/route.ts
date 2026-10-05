import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isReferralSource } from '@/lib/referrals';

export async function GET(request:NextRequest,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const requested=request.nextUrl.searchParams.get('source')??'direct';
 const source=isReferralSource(requested)?requested:'direct';
 if(!/^[a-f0-9]{32}$/.test(token))return new NextResponse('Referral link not found',{status:404});
 const client=await createClient();
 const {data:campaignId,error}=await client.rpc('visit_campaign_referral',{p_token:token,p_source:source});
 if(error||!campaignId)return new NextResponse('Referral link not found',{status:404});
 const response=NextResponse.redirect(new URL(`/c/${encodeURIComponent(campaignId)}#donate`,request.url));
 response.cookies.set('aluna_referral',`campaign.${token}.${source}`,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:30*24*60*60});
 response.headers.set('Cache-Control','private, no-store');
 response.headers.set('Referrer-Policy','no-referrer');
 return response;
}
