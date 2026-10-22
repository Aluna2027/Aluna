import 'server-only';
import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Produces a daily stable pseudonymous identifier for referral deduplication.
 * Vercel overwrites X-Forwarded-For with the visitor IP before invoking the
 * application; only the HMAC is sent to Supabase, never the raw IP address.
 */
export function referralVisitorHash(request:NextRequest){
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
 const ip=request.headers.get('x-real-ip')?.trim()
  ||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ||'unknown';
 const day=new Date().toISOString().slice(0,10);
 return createHmac('sha256',secret).update(`${day}:${ip}`).digest('hex');
}
