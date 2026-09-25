import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { FundraisingFields } from '@/components/fundraising-fields';
import { editFundraiser } from '../../actions';
export default async function EditFundraiser({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{error?:string}>}){const {slug}=await params;const {error}=await searchParams;const client=await createClient();const {data:fundraiser}=await client.from('fundraisers').select('id,slug,actor_id,title,story,goal_amount').eq('slug',slug).maybeSingle();if(!fundraiser)notFound();const actors=await ownedActors();if(!actors.some(a=>a.id===fundraiser.actor_id))notFound();return <div className="space-y-5"><Link href={`/fundraising/${slug}`} className="text-sm text-gold">← Fundraiser</Link><Card title="Edit fundraiser"><form action={editFundraiser} className="max-w-2xl space-y-5"><input type="hidden" name="id" value={fundraiser.id}/><input type="hidden" name="slug" value={slug}/>{error&&<p role="alert" className="text-amber-300">Could not save your changes.</p>}<FundraisingFields values={fundraiser}/><button className="rounded-xl bg-gold px-5 py-3 text-navy">Save changes</button></form></Card></div>}
