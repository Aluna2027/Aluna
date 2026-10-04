import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { updateProfile } from '../actions';

const roleHelp='Builder means you help us implementing the WiFi-networks, Explorer means you explore the community where we implement our WiFi-networks, Rebel means you help users with their crowdfunding on social media and Creator means you document the trip on social media with video and photo footages.';

export default async function EditProfile({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await client.from('profiles').select('display_name,bio,location_text,website,avatar_url,skills,interests,aluna_role').eq('id',user.id).single();
 const {error}=await searchParams;
 return <div className="space-y-5"><Link href="/profile" className="text-sm text-gold hover:underline">← Profile</Link><Card title="Edit your profile"><form action={updateProfile} encType="multipart/form-data" className="max-w-2xl space-y-5">
  {error&&<p role="alert" className="text-amber-300">{error==='validation'?'Check the fields and upload a valid image up to 5 MB.':'Could not save your profile.'}</p>}
  <label className="block text-sm">Display name<input name="display_name" required maxLength={120} defaultValue={profile?.display_name??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm"><span className="inline-flex items-center gap-2">Role<details className="relative inline-block"><summary aria-label="About Aluna roles" className="grid h-5 w-5 cursor-pointer list-none place-items-center rounded-full border border-line text-xs text-gold">?</summary><div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-line bg-panel p-3 text-xs leading-relaxed text-muted shadow-xl">{roleHelp}</div></details></span><select name="aluna_role" required defaultValue={profile?.aluna_role??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="" disabled>Select your role</option><option value="builder">Builder</option><option value="explorer">Explorer</option><option value="rebel">Rebel</option><option value="creator">Creator</option></select></label>
  <label className="block text-sm">About<textarea name="bio" rows={5} maxLength={2000} defaultValue="" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Location<input name="location_text" maxLength={160} defaultValue={profile?.location_text??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Website<input name="website" type="url" maxLength={300} placeholder="https://example.org" defaultValue={profile?.website??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Profile photo<input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-line bg-panel-raised p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-navy"/></label>
  {profile?.avatar_url&&<p className="text-xs text-muted">Uploading a new photo replaces the current profile photo.</p>}
  <label className="block text-sm">Skills (comma separated)<input name="skills" defaultValue={profile?.skills?.join(', ')??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
  <label className="block text-sm">Interests (comma separated)<input name="interests" defaultValue={profile?.interests?.join(', ')??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
  <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Save changes</button>
 </form></Card></div>;
}
