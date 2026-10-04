import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserProfile } from '@/components/user-profile';
import { Card } from '@/components/ui';
import Link from 'next/link';
import type { PublicProfile } from '@/lib/profiles';

export default async function Profile({searchParams}:{searchParams:Promise<{tab?:string;status?:string}>}) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await client.from('profiles').select('id,display_name,bio,avatar_url,location_text,website,skills,interests,aluna_role').eq('id',user.id).single();
 const {data:memberships}=await client.from('organization_members').select('organization_id,member_role,organizations(id,name,organization_type)').eq('profile_id',user.id);
 const {data:actor}=await client.from('actors').select('id').eq('profile_id',user.id).maybeSingle();
 const {tab,status}=await searchParams;
 return <div className="space-y-6"><div className="flex justify-end"><Link href="/settings" className="text-sm text-gold">Account settings →</Link></div><Card title="The First 340"><p className="mb-3">Apply for the special global team program from your existing Aluna profile.</p><Link href="/first-340" className="text-gold">Apply for The First 340 →</Link></Card>{status==='saved'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Profile saved.</p>}
 {profile&&<UserProfile profile={profile as PublicProfile} tab={tab} actorId={actor?.id} isOwner/>}
 <Card title="Your organizations"><div className="space-y-3">{memberships?.map((membership)=>{const org=membership.organizations as unknown as {id:string;name:string;organization_type:string}|null;return org&&<Link key={org.id} href={`/organizations/${org.id}`} className="block rounded-xl border border-line p-3 text-ink hover:border-gold">{org.name} <span className="text-sm text-muted">· {org.organization_type} · {membership.member_role}</span></Link>})}<Link href="/organizations/new" className="inline-block text-sm text-gold hover:underline">Create an organization →</Link></div></Card></div>;
}
