import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ImpactView } from '@/components/impact-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, ownedActors, type FeedPost } from '@/lib/social';
import { communityTabs, metric, type MeshCommunity } from '@/lib/communities';
import { getCity } from '@/lib/cities';
import { Card, Placeholder } from '@/components/ui';
import { ProfileTabs } from '@/components/profile-tabs';
import { tabSlug } from '@/lib/profiles';
import { PostComposer } from '@/components/post-composer';
import { FeedList } from '@/components/feed-list';
import { joinCommunity, leaveCommunity, removeCommunity } from '../actions';
export default async function CommunityPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;status?:string;error?:string;before?:string;before_id?:string}>}) {
 const {id}=await params;const {tab,status,error,before,before_id}=await searchParams;const client=await createClient();
 const {data:row}=await client.from('mesh_communities').select('id,city_id,name,location_text,description,population,people_connected,nodes,local_owners,is_verified,created_at,places(name,country_code,source_key)').eq('id',id).is('removed_at',null).maybeSingle();if(!row)notFound();
 const community=row as unknown as MeshCommunity & {places:{name:string;country_code:string;source_key:string}|null};
 const active=communityTabs.find(t=>tabSlug(t)===tab)??'Overview';
 const actors=await ownedActors();
 const [{data:members},{data:myMemberRows}]=await Promise.all([client.from('mesh_community_members').select('actor_id,member_role').eq('community_id',id).limit(200),actors.length?client.from('mesh_community_members').select('actor_id,member_role').eq('community_id',id).in('actor_id',actors.map(a=>a.id)):Promise.resolve({data:[]})]);
 const details=active==='Members'?await actorDetails((members??[]).map(m=>m.actor_id)):new Map();
 const memberIds=new Set([...(members??[]),...(myMemberRows??[])].map(m=>m.actor_id));const myMembers=actors.filter(a=>memberIds.has(a.id));const canEdit=(myMemberRows??[]).some(m=>m.member_role==='steward');
 const cursor=before&&!Number.isNaN(Date.parse(before))?before:null;
 const {data:missions}=active==='Missions'?await client.from('missions').select('id,title,goal').eq('community_id',id).is('removed_at',null).order('created_at',{ascending:false}).limit(100):{data:null};
 const {data:feed}=active==='Feed'?await client.rpc('mesh_community_feed_page',{p_community:id,p_before:cursor,p_before_id:before_id||null,p_limit:20}):{data:null};
 const posts=(feed??[]) as FeedPost[];const place=community.places;const city=place?.source_key?getCity(place.source_key):null;
 return <div className="space-y-6"><Link href="/communities" className="text-sm text-gold">← Wi-Fi Mesh Communities</Link>
 {status==='saved'&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Community saved.</p>}{error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not complete that action.</p>}
 <header className="rounded-3xl border border-line bg-panel p-7 sm:p-10"><p className="deck-label">PHYSICAL WI-FI MESH COMMUNITY · {place?.name||'CITY'}</p><h1 className="mt-4 text-4xl sm:text-5xl">{community.name}</h1><p className="mt-3 text-muted">{community.location_text}{city?` · ${city.country}`:''}</p><p className="mt-3 text-xs text-muted">{community.is_verified?'Verified details':'Infrastructure figures are self-reported and have not been verified by Aluna.'}</p><div className="mt-6 flex flex-wrap gap-3">{city&&<Link href={`/cities/${city.id}?tab=wifi-mesh-communities`} className="text-sm text-gold">View city →</Link>}{canEdit&&<Link href={`/communities/${id}/edit`} className="text-sm text-gold">Edit community →</Link>}{canEdit&&<form action={removeCommunity}><input type="hidden" name="id" value={id}/><button className="text-sm text-red-300">Delete community</button></form>}</div></header>
 <ProfileTabs base={`/communities/${id}`} tabs={communityTabs} active={tabSlug(active)}/>
 {active==='Overview'&&<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Population',community.population],['People connected',community.people_connected],['Nodes',community.nodes],['Local owners',community.local_owners]].map(([label,value])=><Card key={String(label)} title={String(label)}><p className="text-2xl font-semibold text-ink">{metric(value as number|null)}</p></Card>)}</div><Card title="About"><p className="whitespace-pre-wrap">{community.description||'No description has been added yet.'}</p></Card></>}
 {active==='Members'&&<Card title="People and organizations"><div className="space-y-5">{(['user','university','ngo','company'] as const).map(kind=><section key={kind}><h3 className="mb-2 text-sm text-gold">{kind==='user'?'Users':kind==='university'?'Universities':kind==='ngo'?'NGOs':'Companies'}</h3><div className="space-y-2">{members?.filter(m=>details.get(m.actor_id)?.kind===kind).map(m=>{const actor=details.get(m.actor_id);return actor&&<div key={m.actor_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3"><Link href={actor.href} className="text-gold">{actor.name} <span className="text-xs text-muted">· {actor.kind} · {m.member_role}</span></Link>{m.member_role==='member'&&actors.some(a=>a.id===m.actor_id)&&<form action={leaveCommunity}><input type="hidden" name="community_id" value={id}/><input type="hidden" name="actor_id" value={m.actor_id}/><button className="text-xs text-muted hover:text-ink">Leave</button></form>}</div>})}{!members?.some(m=>details.get(m.actor_id)?.kind===kind)&&<p className="text-sm text-muted">None yet.</p>}</div></section>)}</div>{actors.some(a=>!memberIds.has(a.id))&&<form action={joinCommunity} className="mt-6 flex flex-wrap items-center gap-3"><input type="hidden" name="community_id" value={id}/><select name="actor_id" aria-label="Join as" className="rounded-lg border border-line bg-panel-raised p-2">{actors.filter(a=>!memberIds.has(a.id)).map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select><button className="rounded-lg bg-gold px-4 py-2 text-navy">Join community</button></form>}</Card>}
 {active==='Feed'&&<div className="mx-auto max-w-3xl space-y-5"><PostComposer actors={myMembers} returnTo={`/communities/${id}`} communityId={id}/><FeedList posts={posts} actors={myMembers} returnTo={`/communities/${id}`}/>{posts.length===20&&<Link href={`/communities/${id}?tab=feed&before=${encodeURIComponent(posts[19].created_at)}&before_id=${posts[19].id}`} className="text-gold">Older posts →</Link>}{!myMembers.length&&<p className="text-sm text-muted">Join this community with your profile to post updates.</p>}</div>}
 {active==='Missions'&&<Card title="Missions"><div className="space-y-3">{missions?.map(m=><Link key={m.id} href={`/missions/${m.id}`} className="block rounded-xl border border-line p-3 text-gold hover:border-gold">{m.title}<span className="mt-1 block text-sm text-muted">{m.goal}</span></Link>)}{!missions?.length&&<p>No missions linked to this community yet.</p>}<Link href={`/missions/new?city=${city?.id||''}&community=${id}`} className="inline-block text-sm text-gold">Create a mission →</Link></div></Card>}
 {active==='Contributions'&&<ContributionList communityId={id}/>}
 {active==='Proof'&&<ProofList communityId={id}/>}
 {active==='Impact'&&<ImpactView scope={{communityId:id}}/>}
 {!['Overview','Members','Feed','Missions','Contributions','Proof','Impact'].includes(active)&&<Placeholder title={active} description={`${active} for this mesh community will be added in a later phase.`}/>} 
 </div>;
}
