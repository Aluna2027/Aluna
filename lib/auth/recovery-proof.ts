import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

const RECOVERY_WINDOW_SECONDS = 10 * 60;
const PROOF_CONTEXT = 'aluna:password-recovery-proof:v1';

type RecoveryProof = { sub: string; iat: number; exp: number; jti: string };

function signingKey(secret: string) {
  return createHmac('sha256', secret).update(PROOF_CONTEXT).digest();
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', signingKey(secret)).update(payload).digest('base64url');
}

export function issueRecoveryProof(userId: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  const proof: RecoveryProof = {
    sub: userId,
    iat: now,
    exp: now + RECOVERY_WINDOW_SECONDS,
    jti: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(proof)).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyRecoveryProof(token: string | undefined, userId: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (!token || !userId || !secret) return false;
  const [payload, providedSignature, extra] = token.split('.');
  if (!payload || !providedSignature || extra !== undefined) return false;

  let expectedSignature: Buffer;
  let proof: RecoveryProof;
  try {
    expectedSignature = Buffer.from(signature(payload, secret), 'base64url');
    const actualSignature = Buffer.from(providedSignature, 'base64url');
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return false;
    proof = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as RecoveryProof;
  } catch {
    return false;
  }

  return proof.sub === userId
    && typeof proof.iat === 'number'
    && typeof proof.exp === 'number'
    && typeof proof.jti === 'string'
    && proof.iat <= now + 30
    && proof.exp > now
    && proof.exp - proof.iat === RECOVERY_WINDOW_SECONDS;
}
