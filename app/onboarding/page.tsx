import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { completeOnboarding } from './actions';

export default async function Onboarding({searchParams}:{searchParams:Promise<{error?:string}>}){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await client.from('profiles').select('display_name,onboarded_at,aluna_role').eq('id',user.id).maybeSingle();if(profile?.onboarded_at)redirect('/dashboard');
 const {error}=await searchParams;
 return <main className="grid min-h-screen place-items-center bg-navy p-5"><section className="glass w-full max-w-2xl rounded-2xl p-7 sm:p-10"><p className="deck-label">ALUNA GLOBAL NETWORK · MEMBER</p><h1 className="mt-3 text-3xl">Complete your profile</h1><p className="mt-3 text-muted">A few details to help others connect with you. You can update them later.</p>{error&&<p role="alert" className="mt-4 text-sm text-amber-300">{error==='validation'?'Check your profile fields.':'Could not save your profile.'}</p>}<form action={completeOnboarding} className="mt-7 grid gap-4 sm:grid-cols-2">
 <label className="block text-sm">Name<input name="name" required maxLength={120} defaultValue={profile?.display_name??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm">Role<select name="aluna_role" required defaultValue={profile?.aluna_role??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"><option value="" disabled>Select your role</option><option value="builder">Builder</option><option value="explorer">Explorer</option><option value="rebel">Rebel</option><option value="creator">Creator</option></select></label>
 <label className="block text-sm">Location<input name="location" maxLength={160} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm sm:col-span-2">Profile photo URL (optional)<input name="avatar" type="url" placeholder="https://" className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm sm:col-span-2">About<textarea name="bio" rows={3} maxLength={2000} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm">Skills (comma separated)<input name="skills" placeholder="Community building, research" className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm">Interests (comma separated)<input name="interests" placeholder="Connectivity, sustainability" className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy sm:col-span-2">Enter Aluna</button>
 </form></section></main>;
}
