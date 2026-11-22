import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { hasRecoveryProof } from '@/lib/auth/password-recovery';
import { resetPassword } from '../login/actions';
export default async function ResetPassword({searchParams}:{searchParams:Promise<{error?:string}>}){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 const {error}=await searchParams;
 const recoveryValid=Boolean(user&&await hasRecoveryProof(user.id));
 const invalidMessage='This password reset link is invalid or has expired. Please request a new link.';
 const errorMessage=error==='mismatch'?'Passwords do not match.':error==='validation'?'Use 12–128 characters and try again.':error==='save'?'We couldn’t update your password right now. Please try again.':error==='invalid'||!recoveryValid?invalidMessage:null;
 return <main className="grid min-h-screen place-items-center bg-navy p-5"><section className="glass w-full max-w-md rounded-2xl p-8"><p className="deck-label">ALUNA GLOBAL NETWORK</p><h1 className="mt-3 text-3xl">Choose a new password</h1>{errorMessage&&<p role="alert" className="mt-4 text-sm text-amber-300">{errorMessage}</p>}{!recoveryValid?<Link href="/forgot-password" className="mt-5 inline-block text-sm text-gold">Request a new reset link</Link>:<form action={resetPassword} className="mt-6 space-y-4"><label className="block text-sm">New password<input required type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label><label className="block text-sm">Confirm new password<input required type="password" name="confirm_password" autoComplete="new-password" minLength={12} maxLength={128} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label><p className="text-xs text-muted">Use 12–128 characters.</p><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Update password</button></form>}</section></main>;
}
