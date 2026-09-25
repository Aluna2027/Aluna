import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { updateProfile } from '../actions';
export default async function EditProfile({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await client.from('profiles').select('display_name,bio,location_text,website,avatar_url,skills,interests').eq('id',user.id).single();
 const {error}=await searchParams;
 return <div className="space-y-5"><Link href="/profile" className="text-sm text-gold hover:underline">← Profile</Link><Card title="Edit your profile"><form action={updateProfile} className="max-w-2xl space-y-5">
  {error&&<p role="alert" className="text-amber-300">{error==='validation'?'Check the lengths and website URL.':'Could not save your profile.'}</p>}
  <label className="block text-sm">Display name<input name="display_name" required maxLength={120} defaultValue={profile?.display_name??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">About<textarea name="bio" rows={5} maxLength={2000} defaultValue={profile?.bio??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Location<input name="location_text" maxLength={160} defaultValue={profile?.location_text??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Website<input name="website" type="url" maxLength={300} placeholder="https://example.org" defaultValue={profile?.website??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Profile image URL<input name="avatar_url" type="url" maxLength={500} placeholder="https://example.org/photo.jpg" defaultValue={profile?.avatar_url??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
  <label className="block text-sm">Skills (comma separated)<input name="skills" defaultValue={profile?.skills?.join(', ')??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
  <label className="block text-sm">Interests (comma separated)<input name="interests" defaultValue={profile?.interests?.join(', ')??''} className="mt-2 w-full rounded-xl border border-line bg-input p-3"/></label>
  <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Save changes</button>
 </form></Card></div>;
}
