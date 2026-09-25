import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { updateOrganization } from '../../actions';
export default async function EditOrganization({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:membership}=await client.from('organization_members').select('member_role').eq('organization_id',id).eq('profile_id',user.id).maybeSingle();if(membership?.member_role!=='admin')notFound();
 const {data:org}=await client.from('organizations').select('name,description,website,location_text,logo_url').eq('id',id).maybeSingle();if(!org)notFound();
 return <div className="space-y-5"><Link href={`/organizations/${id}`} className="text-sm text-gold hover:underline">← Organization profile</Link><Card title="Edit organization"><form action={updateOrganization} className="max-w-2xl space-y-5"><input type="hidden" name="id" value={id}/>
 {error&&<p role="alert" className="text-amber-300">{error==='validation'?'Check the lengths and website URL.':'Could not save the organization.'}</p>}
 <label className="block text-sm">Name<input name="name" required minLength={2} maxLength={160} defaultValue={org.name} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">About<textarea name="description" rows={6} maxLength={3000} defaultValue={org.description??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">Location<input name="location_text" maxLength={160} defaultValue={org.location_text??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">Website<input name="website" type="url" maxLength={300} placeholder="https://example.org" defaultValue={org.website??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">Logo URL<input name="logo_url" type="url" maxLength={500} placeholder="https://example.org/logo.png" defaultValue={org.logo_url??''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Save changes</button>
 </form></Card></div>;
}
