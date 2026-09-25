import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { FundraisingFields } from '@/components/fundraising-fields';
import { editCampaign } from '../../../actions';
export default async function EditCampaign({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){const {id}=await params;const {error}=await searchParams;const client=await createClient();const {data:campaign}=await client.from('fundraising_campaigns').select('id,actor_id,title,story,goal_amount').eq('id',id).maybeSingle();if(!campaign)notFound();const actors=await ownedActors();if(!actors.some(a=>a.id===campaign.actor_id))notFound();return <div className="space-y-5"><Link href={`/fundraising/campaigns/${id}`} className="text-sm text-gold">← Campaign</Link><Card title="Edit campaign"><form action={editCampaign} className="max-w-2xl space-y-5"><input type="hidden" name="id" value={id}/>{error&&<p role="alert" className="text-amber-300">Could not save your changes.</p>}<FundraisingFields values={campaign}/><button className="rounded-xl bg-gold px-5 py-3 text-navy">Save changes</button></form></Card></div>}
