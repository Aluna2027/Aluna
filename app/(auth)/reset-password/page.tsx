import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resetPassword } from '../login/actions';
export default async function ResetPassword({searchParams}:{searchParams:Promise<{error?:string}>}){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/forgot-password');const {error}=await searchParams;
 return <main className="grid min-h-screen place-items-center bg-navy p-5"><section className="glass w-full max-w-md rounded-2xl p-8"><p className="deck-label">ALUNA GLOBAL NETWORK</p><h1 className="mt-3 text-3xl">Choose a new password</h1>{error&&<p role="alert" className="mt-4 text-sm text-amber-300">Use 12–128 characters and try again.</p>}<form action={resetPassword} className="mt-6 space-y-4"><label className="block text-sm">New password<input required type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Update password</button></form></section></main>;
}
