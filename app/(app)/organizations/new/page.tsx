import Link from 'next/link';
import { Card } from '@/components/ui';
import { createOrganization } from '../actions';
export default async function NewOrganization({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const {error}=await searchParams;
 return <div className="space-y-5"><Link href="/organizations" className="text-sm text-gold hover:underline">← Organizations</Link><Card title="Create an organization"><p className="mb-5 text-sm">Create a University, NGO or Company profile. You will be its first admin.</p><form action={createOrganization} className="max-w-2xl space-y-5">
 {error&&<p role="alert" className="text-amber-300">{error==='validation'?'Check the name, type and description.':'Could not create the organization.'}</p>}
 <label className="block text-sm">Organization type<select name="organization_type" required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="university">University</option><option value="ngo">NGO</option><option value="company">Company</option></select></label>
 <label className="block text-sm">Name<input name="name" required minLength={2} maxLength={160} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <label className="block text-sm">About<textarea name="description" rows={5} maxLength={3000} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
 <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Create profile</button>
 </form></Card></div>;
}
