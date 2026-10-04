import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserProfile } from '@/components/user-profile';
import type { PublicProfile } from '@/lib/profiles';

export default async function Person({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}) {
 const {id}=await params;const {tab}=await searchParams;const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await client.from('profiles').select('id,display_name,first_name,last_name,bio,avatar_url,location_text,website,skills,interests,aluna_role').eq('id',id).maybeSingle();if(!profile)notFound();
 const {data:actor}=await client.from('actors').select('id').eq('profile_id',id).maybeSingle();
 return <UserProfile profile={profile as PublicProfile} tab={tab} actorId={actor?.id} isOwner={user.id===id}/>;
}
