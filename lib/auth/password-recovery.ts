import 'server-only';
import { cookies } from 'next/headers';
import { verifyRecoveryProof } from './recovery-proof';

export const RECOVERY_COOKIE_NAME = 'aluna-password-recovery';
function signingSecret() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Password recovery signing key is not configured.');
  return serviceKey;
}

export async function hasRecoveryProof(userId: string) {
  const store = await cookies();
  let secret: string;
  try { secret=signingSecret(); } catch { return false; }
  return verifyRecoveryProof(store.get(RECOVERY_COOKIE_NAME)?.value, userId, secret);
}

export async function clearRecoveryProofCookie() {
  const store = await cookies();
  store.set(RECOVERY_COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/reset-password', maxAge: 0 });
}

export function passwordRecoveryRedirectOrigin() {
  if (process.env.VERCEL_ENV === 'preview') {
    const host = process.env.VERCEL_URL;
    if (!host || !/^[a-z0-9.-]+\.vercel\.app$/i.test(host)) {
      throw new Error('A valid Vercel Preview host is required for password recovery.');
    }
    return `https://${host}`;
  }

  const raw = process.env.ALUNA_SITE_URL;
  if (!raw) throw new Error('ALUNA_SITE_URL is not configured.');
  const origin = new URL(raw);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) {
    throw new Error('ALUNA_SITE_URL must be HTTPS.');
  }
  return origin.origin;
}

