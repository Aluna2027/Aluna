import { notFound,redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
/** Retire the legacy personal/team fundraiser creation form.
 * Keep existing /fundraising/[slug] pages and all historical donations intact.
 */
export default async function NewLegacyFundraiser({searchParams}:{searchParams:Promise<{campaign?:string}>}){
 const {campaign:id}=await searchParams;
 const client=await createClient();
 const {data}=await client.from('fundraising_campaigns').select('mission_id').eq('id',id??'').is('removed_at',null).maybeSingle();
 if(!data)notFound();
 redirect(`/fundraising/campaigns/new?mission=${data.mission_id}`);
}
