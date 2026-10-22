import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/org-access';
import { isReferralSource } from '@/lib/referrals';
import { referralVisitorHash } from '@/lib/referral-visit';
export async function GET(request:NextRequest,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;const requested=request.nextUrl.searchParams.get('source')??'direct';const source=isReferralSource(requested)?requested:'direct';
 if(!/^[a-f0-9]{32}$/.test(token))return new NextResponse('Referral link not found',{status:404});
 const db=adminDb();const {data:slug,error}=await db.rpc('visit_fundraiser_referral',{p_token:token,p_source:source,p_visitor_hash:referralVisitorHash(request)});
 if(error||!slug)return new NextResponse('Referral link not found',{status:404});
 const response=NextResponse.redirect(new URL(`/f/${encodeURIComponent(slug)}`,request.url));
 response.cookies.set('aluna_referral',`${token}.${source}`,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:7*24*60*60});
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
