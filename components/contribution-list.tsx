import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { actorDetails } from '@/lib/social';
import { contributionLabel, type Contribution } from '@/lib/contributions';
import { Card } from '@/components/ui';

export async function ContributionList({actorId,missionId,communityId,cityKey,page=0}:{actorId?:string;missionId?:string;communityId?:string;cityKey?:string;page?:number}) {
 const client=await createClient();
 let cityId:string|undefined;
 if(cityKey){const {data}=await client.from('places').select('id').eq('source_key',cityKey).maybeSingle();if(!data)return <Card title="Contributions"><p>City unavailable.</p></Card>;cityId=data.id;}
 let query=client.from('contributions').select('id,actor_id,contribution_type,title,description,contributed_on,created_at,mission_id,community_id,city_id,places(name,source_key),missions(title),mesh_communities(name)').order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+19);
 if(actorId)query=query.eq('actor_id',actorId);
 if(missionId)query=query.eq('mission_id',missionId);
 if(communityId)query=query.eq('community_id',communityId);
 if(cityId)query=query.eq('city_id',cityId);
 const {data,error}=await query;
 const items=(data??[]) as unknown as Contribution[];
 const actors=await actorDetails(items.map(item=>item.actor_id));
 const params=new URLSearchParams();if(actorId)params.set('actor',actorId);if(missionId)params.set('mission',missionId);if(communityId)params.set('community',communityId);if(cityKey)params.set('city',cityKey);
 const next=new URLSearchParams(params);next.set('page',String(page+1));
 return <Card title="Contributions"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">Contributions are self-reported. Money entries are not verified donations.</p><Link href={`/contributions/new${params.size?`?${params}`:''}`} className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-navy">Add contribution</Link></div>
 {error?<p>Could not load contributions.</p>:items.length?<div className="space-y-3">{items.map(item=><article key={item.id} className="rounded-xl border border-line p-4"><p className="deck-label">{contributionLabel(item.contribution_type)} · {item.contributed_on}</p><Link href={`/contributions/${item.id}`} className="mt-2 block text-lg font-semibold text-ink hover:text-gold">{item.title} →</Link><p className="mt-2 line-clamp-2 text-sm">{item.description}</p><p className="mt-3 text-xs"><Link href={actors.get(item.actor_id)?.href??'/contributions'} className="text-gold">{actors.get(item.actor_id)?.name??'Member'}</Link>{item.missions&&` · ${item.missions.title}`}{item.mesh_communities&&` · ${item.mesh_communities.name}`}{item.places&&` · ${item.places.name}`}</p></article>)}</div>:<p>No contributions recorded yet.</p>}
 {items.length===20&&<Link href={`/contributions?${next}`} className="mt-5 inline-block text-gold">More contributions →</Link>}</Card>;
}
