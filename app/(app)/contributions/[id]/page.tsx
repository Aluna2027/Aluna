import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails } from '@/lib/social';
import { getCity } from '@/lib/cities';
import { contributionLabel, type Contribution } from '@/lib/contributions';
import { Card } from '@/components/ui';
import { ProofList } from '@/components/proof-list';
export default async function ContributionPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const client=await createClient();const {data}=await client.from('contributions').select('id,actor_id,contribution_type,title,description,contributed_on,created_at,mission_id,community_id,city_id,places(name,source_key),missions(title),mesh_communities(name)').eq('id',id).maybeSingle();if(!data)notFound();
 const entry=data as unknown as Contribution;
 // Evidence metadata is filtered by RLS; no Storage paths are exposed in the page.
 const [{data:evidence,error:evidenceError},actors]=await Promise.all([
  client.from('pr43_contribution_files').select('id,filename,uploaded_at').eq('contribution_id',id).order('uploaded_at',{ascending:false}),
  actorDetails([entry.actor_id])
 ]);
 const actor=actors.get(entry.actor_id);const city=entry.places?.source_key?getCity(entry.places.source_key):null;
 return <div className="space-y-6"><Link href="/contributions" className="text-sm text-gold">← Contributions</Link><header className="rounded-3xl border border-line bg-panel p-7 sm:p-10"><p className="deck-label">{contributionLabel(entry.contribution_type)} · {entry.contributed_on}</p><h1 className="mt-4 text-4xl">{entry.title}</h1><p className="mt-3 text-sm text-muted">Self-reported contribution{entry.contribution_type==='money'?' · This does not represent a verified donation.':''}</p></header>
 <Card title="Details"><p className="whitespace-pre-wrap">{entry.description}</p><div className="mt-6 space-y-2 text-sm"><p>Contributor: {actor?<Link href={actor.href} className="text-gold">{actor.name}</Link>:'Member'}</p>{entry.mission_id&&<p>Mission: <Link href={`/missions/${entry.mission_id}`} className="text-gold">{entry.missions?.title??'View mission'}</Link></p>}{entry.community_id&&<p>Wi-Fi Mesh Community: <Link href={`/communities/${entry.community_id}`} className="text-gold">{entry.mesh_communities?.name??'View community'}</Link></p>}{city&&<p>City: <Link href={`/cities/${city.id}`} className="text-gold">{city.name}, {city.country}</Link></p>}</div></Card><Card title="Supporting evidence">
  <p className="mb-4 text-sm text-muted">Files uploaded with this Contribution. Downloads are available only to people with permission to view the evidence.</p>
  {evidenceError?<p className="text-sm text-muted" role="alert">Could not load evidence files.</p>
   :evidence?.length?<ul className="space-y-3">{evidence.map(file=><li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
    <span className="min-w-0 break-all text-sm text-ink">{file.filename}</span>
    <a href={`/api/pr43/evidence?fileId=${encodeURIComponent(file.id)}`} className="shrink-0 rounded-xl border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-panel-raised">Download file</a>
   </li>)}</ul>
   :<p className="text-sm text-muted">No evidence files available to this account.</p>}
 </Card>
 <ProofList contributionId={id}/></div>;
}
