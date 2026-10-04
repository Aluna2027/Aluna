import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { completeOnboarding } from './actions';

const roleHelp='Builder means you help us implementing the WiFi-networks, Explorer means you explore the community where we implement our WiFi-networks, Rebel means you help users with their crowdfunding on social media and Creator means you document the trip on social media with video and photo footages.';

export default async function Onboarding({searchParams}:{searchParams:Promise<{error?:string}>}){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await client.from('profiles').select('display_name,first_name,last_name,onboarded_at,aluna_role').eq('id',user.id).maybeSingle();if(profile?.onboarded_at)redirect('/dashboard');
 const {error}=await searchParams;
 return <main className="grid min-h-screen place-items-center bg-navy p-5"><section className="glass w-full max-w-2xl rounded-2xl p-7 sm:p-10"><p className="deck-label">ALUNA GLOBAL NETWORK · MEMBER</p><h1 className="mt-3 text-3xl">Complete your profile</h1><p className="mt-3 text-muted">A few details to help others connect with you. You can update them later.</p>{error&&<p role="alert" className="mt-4 text-sm text-amber-300">{error==='validation'?'Check your profile fields and upload a valid image up to 5 MB.':'Could not save your profile.'}</p>}<form action={completeOnboarding} encType="multipart/form-data" className="mt-7 grid gap-4 sm:grid-cols-2">
 <label className="block text-sm sm:col-span-2">Display name<input name="display_name" required maxLength={120} defaultValue={profile?.display_name??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm">First name<input name="first_name" required maxLength={80} defaultValue={profile?.first_name??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm">Last name<input name="last_name" required maxLength={80} defaultValue={profile?.last_name??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm"><span className="inline-flex items-center gap-2">Role<details className="relative inline-block"><summary aria-label="About Aluna roles" className="grid h-5 w-5 cursor-pointer list-none place-items-center rounded-full border border-line text-xs text-gold">?</summary><div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-line bg-panel p-3 text-xs leading-relaxed text-muted shadow-xl">{roleHelp}</div></details></span><select name="aluna_role" required defaultValue={profile?.aluna_role??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"><option value="" disabled>Select your role</option><option value="builder">Builder</option><option value="explorer">Explorer</option><option value="rebel">Rebel</option><option value="creator">Creator</option></select></label>
 <label className="block text-sm">Location<input name="location" maxLength={160} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm sm:col-span-2">Profile photo<input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-line bg-input p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-navy"/></label>
 <label className="block text-sm sm:col-span-2">About<textarea name="bio" rows={3} maxLength={2000} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm">Skills (comma separated)<input name="skills" placeholder="Community building, research" className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <label className="block text-sm">Interests (comma separated)<input name="interests" placeholder="Connectivity, sustainability" className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
 <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy sm:col-span-2">Enter Aluna</button>
 </form></section></main>;
}
