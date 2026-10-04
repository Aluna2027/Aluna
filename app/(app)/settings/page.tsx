import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { changeAccountEmail,changeAccountPassword } from './actions';

function accountErrorMessage(error?:string){
 if(error==='email-in-use')return 'That email address is already linked to another Aluna account. Use a different email address.';
 if(error==='email-current')return 'That is already your current email address.';
 if(error==='email')return 'Could not update your email address. Check the address and try again.';
 if(error==='password')return 'Could not update your password. Check your details and try again.';
 return '';
}

export default async function Settings({searchParams}:{searchParams:Promise<{error?:string;status?:string}>}){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');const {error,status}=await searchParams;const errorMessage=accountErrorMessage(error);
 return <div className="space-y-6"><header><p className="deck-label">ALUNA · ACCOUNT</p><h1 className="mt-2 text-4xl">Account settings</h1><Link className="mt-3 inline-block text-gold" href="/profile/edit">Edit public profile →</Link></header>{errorMessage&&<p role="alert" className="text-sm text-amber-300">{errorMessage}</p>}{status&&<p role="status" className="text-sm text-gold">{status==='email'?'Check your new email address to confirm the change. After confirmation you will return to Overview.':'Password updated.'}</p>}<div className="grid gap-5 md:grid-cols-2"><div id="email"><Card title="Email address"><p className="mb-4 text-sm">Current: {user.email}</p><form action={changeAccountEmail} className="space-y-4"><label className="block text-sm">New email<input type="email" name="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label><button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Change email</button></form></Card></div><div id="password"><Card title="Password"><form action={changeAccountPassword} className="space-y-4"><label className="block text-sm">New password<input type="password" name="password" required minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label><button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Change password</button></form></Card></div></div></div>;
}
