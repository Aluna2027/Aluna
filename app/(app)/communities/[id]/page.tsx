import { Wifi, Earth, MapPin, ShieldAlert, Map as MapIcon, Pencil, Trash2, UsersRound, Network, UserRoundCheck, BookOpen } from 'lucide-react';
import { DetailPageHeader, DetailMetricCard, DetailSectionCard } from '@/components/detail-design-elements';
import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ImpactView } from '@/components/impact-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, attachPostMedia, ownedActors, type FeedPost } from '@/lib/social';
import { communityTabs, metric, type MeshCommunity } from '@/lib/communities';
import { getCity } from '@/lib/cities';
import { Card } from '@/components/ui';
import { CircleCheck } from 'lucide-react';
import { CommunityMissionCards, CommunityFundraisingCards } from '@/components/profile-directory-cards';
import { ProfileTabs } from '@/components/profile-tabs';
import { tabSlug } from '@/lib/profiles';
import { PostComposer } from '@/components/post-composer';
import { FeedList } from '@/components/feed-list';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
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
 const {data:feed}=active==='Feed'?await client.rpc('mesh_community_feed_page',{p_community:id,p_before:cursor,p_before_id:before_id||null,p_limit:20}):{data:null};
 const rawPosts=(feed??[]) as FeedPost[];
 const {data:postMedia}=active==='Feed'&&rawPosts.length?await client.from('posts').select('id,media_path,media_type').in('id',rawPosts.map(p=>p.id)):{data:[]};
 const mediaById=new Map((postMedia??[]).map(row=>[row.id,row]));
 const posts=await attachPostMedia(rawPosts.map(post=>({...post,...mediaById.get(post.id)})));
 const place=community.places;const city=place?.source_key?getCity(place.source_key):null;
 const {data:{user}}=await client.auth.getUser();
 const {data:visitor}=user?await client.from('profiles').select('display_name').eq('id',user.id).maybeSingle():{data:null};
 const visitorName=visitor?.display_name||user?.email?.split('@')[0]||'member';
 return <div className="space-y-6"><DetailPageHeader kind="WI-FI MESH COMMUNITY" title={community.name} backHref="/communities" backLabel="Wi-Fi Mesh Communities" visitorName={visitorName}/>
 {status==='saved'&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Community saved.</p>}{error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not complete that action.</p>}
 <ProfileTabs base={`/communities/${id}`} tabs={communityTabs} active={tabSlug(active)} variant="detail"/>
 {active==='Overview'&&<>
  <header className="rounded-[23px] border border-line bg-panel p-5 sm:p-6">
   <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex size-14 items-center justify-center rounded-xl bg-[#173638]"><Wifi size={28} color="#26E7D4"/></span><span className="text-sm font-semibold text-gold">PHYSICAL WI-FI MESH COMMUNITY</span></div><Earth size={25} className="hidden text-[#8A4DFF] sm:block"/></div>
   <h2 className="mt-5 break-words text-[28px] font-bold normal-case leading-tight text-ink [font-stretch:normal] sm:ml-[68px] sm:text-[30px]">{community.name}</h2>
   <p className="mt-7 flex items-center gap-3 text-base text-muted sm:text-lg"><MapPin size={20} className="shrink-0 text-[#26E7D4]"/>{city?city.name+', '+city.country:community.location_text}</p>
   <p className="mt-6 text-base font-semibold text-gold sm:text-lg">SDG 9: Industry, Innovation and Infrastructure</p>
   <p className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-muted sm:text-base"><ShieldAlert size={19} className="mt-0.5 shrink-0"/>{community.is_verified?'Verified details':'Infrastructure figures are self-reported and have not been verified by Aluna.'}</p>
   <div className="mt-9 flex flex-wrap items-center gap-5 border-t border-line pt-8 text-base">
    {city&&<Link href={'/cities/'+city.id+'?tab=wifi-mesh-communities'} className="inline-flex items-center gap-2 text-[#26E7D4] hover:underline"><MapIcon size={19}/>View City →</Link>}
    {canEdit&&<Link href={'/communities/'+id+'/edit'} className="inline-flex items-center gap-2 text-gold hover:underline"><Pencil size={18}/><span className="sm:hidden">Edit</span><span className="hidden sm:inline">Edit Community</span></Link>}
    {canEdit&&<form action={removeCommunity}><input type="hidden" name="id" value={id}/><ConfirmSubmitButton message="Are you sure you want to delete this community?" className="inline-flex items-center gap-2 text-[#E49BA3]"><Trash2 size={18}/><span className="sm:hidden">Delete</span><span className="hidden sm:inline">Delete Community</span></ConfirmSubmitButton></form>}
   </div>
  </header>
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   <DetailMetricCard label="Population" value={metric(community.population)} icon={<UsersRound size={24} color="#FFC43D"/>}/>
   <DetailMetricCard label="People Connected" value={metric(community.people_connected)} icon={<Wifi size={24} color="#26E7D4"/>}/>
   <DetailMetricCard label="Nodes" value={metric(community.nodes)} icon={<Network size={24} color="#8A4DFF"/>}/>
   <DetailMetricCard label="Local Owners" value={metric(community.local_owners)} icon={<UserRoundCheck size={24} color="#FF4FD8"/>}/>
  </div>
  <DetailSectionCard title="ABOUT THIS WI-FI MESH COMMUNITY" mobileTitle="ABOUT THIS COMMUNITY" icon={<BookOpen size={25} color="#8A4DFF"/>}><p className="whitespace-pre-wrap">{community.description||'No description has been added yet.'}</p></DetailSectionCard>
 </>}
 {active==='Members'&&<Card title="People and organizations"><div className="space-y-5">{(['user','university','ngo','company'] as const).map(kind=><section key={kind}><h3 className="mb-2 text-sm text-gold">{kind==='user'?'Users':kind==='university'?'Universities':kind==='ngo'?'NGOs':'Companies'}</h3><div className="space-y-2">{members?.filter(m=>details.get(m.actor_id)?.kind===kind).map(m=>{const actor=details.get(m.actor_id);return actor&&<div key={m.actor_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3"><Link href={actor.href} className="inline-flex items-center gap-2 text-gold"><CircleCheck aria-label="Community member" size={17} className="shrink-0 text-[#26E7D4]"/>{actor.name} <span className="text-xs text-muted">· {actor.kind} · {m.member_role}</span></Link>{m.member_role==='member'&&actors.some(a=>a.id===m.actor_id)&&<form action={leaveCommunity}><input type="hidden" name="community_id" value={id}/><input type="hidden" name="actor_id" value={m.actor_id}/><button className="text-xs text-muted hover:text-ink">Leave</button></form>}</div>})}{!members?.some(m=>details.get(m.actor_id)?.kind===kind)&&<p className="text-sm text-muted">None yet.</p>}</div></section>)}</div>{actors.some(a=>!memberIds.has(a.id))&&<form action={joinCommunity} className="mt-6 flex flex-wrap items-center gap-3"><input type="hidden" name="community_id" value={id}/><select name="actor_id" aria-label="Join as" className="rounded-lg border border-line bg-panel-raised p-2">{actors.filter(a=>!memberIds.has(a.id)).map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select><button className="rounded-lg bg-gold px-4 py-2 text-navy">Join community</button></form>}</Card>}
 {active==='Feed'&&<div className="mx-auto max-w-3xl space-y-5"><PostComposer actors={myMembers} returnTo={`/communities/${id}`} communityId={id}/><FeedList posts={posts} actors={myMembers} returnTo={`/communities/${id}`}/>{posts.length===20&&<Link href={`/communities/${id}?tab=feed&before=${encodeURIComponent(posts[19].created_at)}&before_id=${posts[19].id}`} className="text-gold">Older posts →</Link>}{!myMembers.length&&<p className="text-sm text-muted">Join this community with your profile to post updates.</p>}</div>}
 {active==='Missions'&&<CommunityMissionCards communityId={id} createHref={`/missions/new?city=${city?.id||''}&community=${id}`}/>}
 {active==='Fundraising'&&<CommunityFundraisingCards communityId={id}/>}

 {active==='Contributions'&&<ContributionList communityId={id}/>}
 {active==='Proof'&&<ProofList communityId={id}/>}
 {active==='Impact'&&<ImpactView scope={{communityId:id}}/>}
 {!['Overview','Members','Feed','Missions','Fundraising','Contributions','Proof','Impact'].includes(active)&&<Placeholder title={active} description={`${active} for this mesh community will be added in a later phase.`}/>} 
 </div>;
}
