import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const proof = read('../../lib/auth/password-recovery.ts');
const cryptoProof = read('../../lib/auth/recovery-proof.ts');
const actions = read('../../app/(auth)/login/actions.ts');
const callback = read('../../app/auth/callback/route.ts');
const resetPage = read('../../app/(auth)/reset-password/page.tsx');
const forgotPage = read('../../app/(auth)/forgot-password/page.tsx');
const loginPage = read('../../app/(auth)/login/page.tsx');

test('recovery proof is signed, short lived, user bound, HttpOnly and server only', () => {
  assert.match(proof, /import ['"]server-only['"]/);
  assert.match(cryptoProof, /createHmac\(['"]sha256['"], secret\)/);
  assert.match(cryptoProof, /timingSafeEqual/);
  assert.match(cryptoProof, /proof\.sub === userId/);
  assert.match(cryptoProof, /RECOVERY_WINDOW_SECONDS = 10 \* 60/);
  assert.match(callback, /httpOnly:true/);
  assert.match(callback, /maxAge:600/);
  assert.doesNotMatch(proof, /NEXT_PUBLIC_.*SERVICE_ROLE|console\.(log|error)/);
});

test('recovery proof rejects tampering, other users, malformed tokens and expired tokens', async () => {
  const { issueRecoveryProof, verifyRecoveryProof } = await import('../../lib/auth/recovery-proof.ts');
  const secret='unit-test-secret-that-is-never-used-in-deployment';
  const now=1_700_000_000;
  const token=issueRecoveryProof('authorized-user',secret,now);
  assert.equal(verifyRecoveryProof(token,'authorized-user',secret,now+1),true);
  assert.equal(verifyRecoveryProof(token,'different-user',secret,now+1),false);
  assert.equal(verifyRecoveryProof(token,'authorized-user',secret,now+600),false);
  assert.equal(verifyRecoveryProof(`${token}x`,'authorized-user',secret,now+1),false);
  assert.equal(verifyRecoveryProof('not-a-proof','authorized-user',secret,now+1),false);
});

test('normal authenticated sessions cannot update passwords without a valid recovery proof', () => {
  assert.match(actions, /client\.auth\.getUser\(\)/);
  assert.match(actions, /hasRecoveryProof\(user\.id\)/);
  assert.ok(actions.indexOf('hasRecoveryProof(user.id)') < actions.indexOf('client.auth.updateUser({password})'));
  assert.match(resetPage, /hasRecoveryProof\(user\.id\)/);
  assert.match(resetPage, /name="confirm_password"/);
});

test('callback creates a recovery proof only after successful Auth verification', () => {
  assert.match(callback, /if \(!error\)\s*\{[\s\S]*?if\(isRecoveryFlow\)return user\?validRecovery\(user\.id\):invalidRecovery\(\)/);
  assert.match(callback, /verifyOtp\(\{\s*token_hash: token,\s*type: isRecoveryFlow \? 'recovery' : 'signup'/);
  assert.match(callback, /if\(isRecoveryFlow\)return validRecovery\(user\.id\)/);
  assert.match(callback, /if\(isRecoveryFlow\)return invalidRecovery\(\)/);
  assert.match(callback, /RECOVERY_COOKIE_NAME/);
});

test('request result does not reveal account existence and distinguishes infrastructure failures', () => {
  assert.match(actions, /status>=500/);
  assert.match(actions, /!Number\.isFinite\(status\)/);
  assert.match(forgotPage, /If an account exists for this email address, you will receive instructions to reset your password\./);
  assert.match(forgotPage, /We couldn&apos;t process your request right now\. Please try again later\./);
  assert.doesNotMatch(actions, /console\.(log|error).*email|redirectTo.*searchParams/);
});

test('Preview recovery redirect uses its deployment host without changing the canonical site URL', () => {
  assert.match(proof, /process\.env\.VERCEL_ENV === 'preview'/);
  assert.match(proof, /process\.env\.VERCEL_URL/);
  assert.match(proof, /\\.vercel\\.app/);
  assert.match(proof, /ALUNA_SITE_URL/);
  assert.match(actions, /passwordRecoveryRedirectOrigin\(\)/);
});

test('password policy, matching confirmation, sign out and success text are preserved', () => {
  assert.match(actions, /password!==confirmPassword/);
  assert.match(actions, /password\.length<12\|\|password\.length>128/);
  assert.match(actions, /signOut\(\{scope:'local'\}\)/);
  assert.match(loginPage, /Your password has been updated\. Please sign in again\./);
});

test('signup and onboarding redirect construction remains on the existing flow', () => {
  assert.match(actions, /options:\{emailRedirectTo:`\$\{siteOrigin\(\)\}\/auth\/callback\?flow=signup/);
  assert.match(actions, /redirect\(data\.session \? '\/onboarding'/);
});
