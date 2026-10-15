import { MapPin, UserRoundPlus, HandCoins, Heart, BookOpen, Target, ChartNoAxesColumnIncreasing, Pencil, UserRound } from 'lucide-react';
import { DetailPageHeader, DetailSectionCard, DetailSdgIcons, DetailSdgRows, featuredSdg } from '@/components/detail-design-elements';
import { MissionParticipationControl } from '@/components/mission-participation-control';
import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ImpactView } from '@/components/impact-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, attachPostMedia, ownedActors, relativeDate, type FeedPost } from '@/lib/social';
import { getCity } from '@/lib/cities';
import { type Mission, missionTabs, missionTabFromSlug, money, participationOptions } from '@/lib/missions';
import { tabSlug } from '@/lib/profiles';
import { Card, Placeholder } from '@/components/ui';
import { ProfileTabs } from '@/components/profile-tabs';
import { PostComposer } from '@/components/post-composer';
import { FeedList } from '@/components/feed-list';
import { MissionFundraising } from '@/components/mission-fundraising';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { joinMission, leaveMission, removeMission } from '../actions';
import { DirectorySdgIcon } from '@/components/directory-sdg-icon';
export default async function MissionPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;status?:string;error?:string;before?:string;before_id?:string}>}) {
 const {id}=await params;const {tab,status,error,before,before_id}=await searchParams;const client=await createClient();
 const {data:row}=await client.from('missions').select('*,places(name,source_key),mesh_communities(name)').eq('id',id).is('removed_at',null).maybeSingle();if(!row)notFound();
 const mission=row as unknown as Mission & {places:{name:string;source_key:string}|null;mesh_communities:{name:string}|null};
 const active=missionTabFromSlug(tab);const actors=await ownedActors();
 const [{data:participants},{data:mine}]=await Promise.all([client.from('mission_participations').select('actor_id,participation_kind,joined_at').eq('mission_id',id).limit(200),actors.length?client.from('mission_participations').select('actor_id,participation_kind').eq('mission_id',id).in('actor_id',actors.map(a=>a.id)):Promise.resolve({data:[]})]);
 const participantIds=[...new Set((participants??[]).map(p=>p.actor_id))];const detail=await actorDetails([...participantIds,mission.created_by_actor_id]);
 const canEdit=actors.some(a=>a.id===mission.created_by_actor_id);const participantActors=actors.filter(a=>a.id===mission.created_by_actor_id||mine?.some(p=>p.actor_id===a.id));
 const creator=detail.get(mission.created_by_actor_id);const city=mission.places?.source_key?getCity(mission.places.source_key):null;
 const manualPlace=mission.manual_place&&mission.manual_country?`${mission.manual_place}, ${mission.manual_country}`:null;
 const cursor=before&&!Number.isNaN(Date.parse(before))?before:null;
 const {data:feed}=active==='Communication'?await client.rpc('mission_feed_page',{p_mission:id,p_before:cursor,p_before_id:before_id||null,p_limit:20}):{data:null};
 const rawPosts=(feed??[]) as FeedPost[];
 const {data:postMedia}=active==='Communication'&&rawPosts.length?await client.from('posts').select('id,media_path,media_type').in('id',rawPosts.map(p=>p.id)):{data:[]};
 const mediaById=new Map((postMedia??[]).map(row=>[row.id,row]));
 const posts=await attachPostMedia(rawPosts.map(post=>({...post,...mediaById.get(post.id)})));
 const {data:missionPosts}=active==='Communication'?await client.from('posts').select('id').eq('mission_id',id).order('created_at',{ascending:false}).limit(100):{data:null};
 const postIds=(missionPosts??[]).map(p=>p.id);
 const {data:comments}=active==='Communication'&&postIds.length?await client.from('comments').select('id,post_id,actor_id,body,created_at').in('post_id',postIds).order('created_at',{ascending:false}).limit(50):{data:null};
 const commentActors=active==='Communication'?await actorDetails((comments??[]).map(c=>c.actor_id)):new Map();
 const {data:missionSdgs}=await client.from('mission_sdgs').select('sdg_number').eq('mission_id',id).order('sdg_number');
 const {data:{user}}=await client.auth.getUser();
 const {data:visitor}=user?await client.from('profiles').select('display_name').eq('id',user.id).maybeSingle():{data:null};
 const visitorName=visitor?.display_name||user?.email?.split('@')[0]||'member';
 const base=`/missions/${id}`;
 return <div className="space-y-6">
 <DetailPageHeader kind="SDG MISSION" title={mission.title} backHref="/missions" backLabel="SDG Missions" visitorName={visitorName}/>
 <ProfileTabs base={base} tabs={missionTabs} active={tabSlug(active)} variant="detail"/>
 {status==='saved'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Mission saved.</p>}
 {status==='joined'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Your mission participation has been saved.</p>}
 {status==='already-joined'&&<p role="status" className="rounded-lg border border-line p-3 text-muted">You already participate with the selected types.</p>}
 {error&&<p role="alert" className="rounded-lg border border-red-700 p-3 text-red-300">Could not complete that action.</p>}
 {active==='Overview'&&<><header className="rounded-[22px] border border-line bg-panel p-5 sm:p-6">
  <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#173638] sm:size-16"><DirectorySdgIcon number={featuredSdg((missionSdgs??[]).map(s=>s.sdg_number),Boolean(mission.community_id))} size={29}/></span><p className="text-sm font-semibold text-gold">SDG MISSION</p></div><div className="flex items-center gap-3">{(missionSdgs??[]).map(s=>s.sdg_number).filter(n=>n!==featuredSdg((missionSdgs??[]).map(s=>s.sdg_number),Boolean(mission.community_id))).map(n=><DirectorySdgIcon key={n} number={n} size={24}/>)}</div></div>
  <h2 className="mt-7 break-words text-[28px] font-bold normal-case leading-tight text-ink [font-stretch:normal] sm:text-[35px]">{mission.title}</h2>
  <p className="mt-6 flex items-center gap-3 text-base text-muted sm:text-lg"><MapPin size={21} className="shrink-0 text-[#26E7D4]"/>{manualPlace|| (city?city.name+', '+city.country:mission.location_text)}</p>
  <div className="mt-6 text-base leading-relaxed sm:text-lg"><DetailSdgRows numbers={(missionSdgs??[]).map(s=>s.sdg_number)} primary={featuredSdg((missionSdgs??[]).map(s=>s.sdg_number),Boolean(mission.community_id))}/></div>
  <div className="mt-8 border-t border-line pt-7">
   <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
    <Link href={base+'?tab=participate#participants'} className="col-span-2 flex min-h-[65px] items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-navy sm:col-span-1"><UserRoundPlus size={19}/>Join Mission</Link>
    <Link href={'/fundraising/campaigns/new?mission='+id} className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl border border-[#26E7D4] bg-[#142F2E] px-4 font-semibold text-[#26E7D4] sm:min-h-[65px]"><HandCoins size={19}/><span className="text-center">Start Fundraising</span></Link>
    <Link href={base+'?tab=fundraising#donate'} className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl border border-[#FF4FD8] bg-[#321A33] px-4 font-semibold text-[#FF4FD8] sm:min-h-[65px]"><Heart size={19}/>Donate</Link>
   </div>
   <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm text-muted"><UserRound size={19}/>Created by {creator?.name||'Member'}</p>{canEdit&&<Link href={base+'/edit'} className="inline-flex items-center gap-2 text-sm text-gold"><Pencil size={18}/>Edit Mission</Link>}</div>
   {canEdit&&<form action={removeMission} className="mt-2 text-right"><input type="hidden" name="id" value={id}/><ConfirmSubmitButton message="Are you sure you want to delete this SDG Mission?" className="text-xs text-[#E49BA3]">Delete SDG Mission</ConfirmSubmitButton></form>}
  </div>
 </header>
 <div className="grid gap-4 sm:grid-cols-2">
  <DetailSectionCard title="OVERVIEW" icon={<BookOpen size={24} color="#8A4DFF"/>}><p className="whitespace-pre-wrap">{mission.overview}</p></DetailSectionCard>
  <DetailSectionCard title="GOAL" icon={<Target size={24} color="#FFC43D"/>}><p className="whitespace-pre-wrap">{mission.goal}</p></DetailSectionCard>
  <DetailSectionCard title="WHERE" icon={<MapPin size={24} color="#26E7D4"/>}><p>{manualPlace||(city?city.name+', '+city.country:mission.location_text)}</p>{city&&<Link href={'/cities/'+city.id+'?tab=missions'} className="mt-3 block text-base text-gold">View city →</Link>}{mission.community_id&&<Link href={'/communities/'+mission.community_id+'?tab=missions'} className="mt-3 block text-base text-gold">Linked Wi-Fi Mesh Community →</Link>}</DetailSectionCard>
  <DetailSectionCard title="AT A GLANCE" icon={<ChartNoAxesColumnIncreasing size={24} color="#FF4FD8"/>}><div className="space-y-3 text-base"><div className="flex justify-between gap-2"><span>Timeline</span><span className="text-right text-ink">{mission.starts_on&&mission.ends_on?mission.starts_on+' – '+mission.ends_on:mission.starts_on||mission.ends_on||'Not set'}</span></div><div className="flex justify-between gap-2"><span>Budget</span><span className="text-right text-ink">{money(mission.budget_amount,mission.currency_code)}</span></div><div className="flex justify-between gap-2"><span>Funding goal</span><span className="text-right text-gold">{money(mission.funding_goal_amount,mission.currency_code)}</span></div></div></DetailSectionCard>
 </div></>}
 {active==='Participate'&&<section id="team"><Card title="Team"><p className="mb-4">Mission creator: <Link href={creator?.href||'/missions'} className="text-gold">{creator?.name||'Member'}</Link></p><div className="space-y-2">{participants?.filter(p=>p.participation_kind==='join_team').map(p=><Link key={p.actor_id} href={detail.get(p.actor_id)?.href||'/missions'} className="block rounded-lg border border-line p-3 text-gold">{detail.get(p.actor_id)?.name||'Member'}</Link>)}{!participants?.some(p=>p.participation_kind==='join_team')&&<p>No team members yet.</p>}</div></Card></section>}
 {active==='Participate'&&<section id="roles"><Card title="Roles"><p className="whitespace-pre-wrap">{mission.roles_summary||'Specific team roles have not been described yet.'}</p><div className="mt-5 flex flex-wrap gap-2">{participationOptions.map(o=><span key={o.value} className="rounded-full border border-line px-3 py-1 text-xs">{o.label}</span>)}</div></Card></section>}
 {active==='Fundraising'&&<section id="budget"><Card title="Budget"><p className="text-2xl text-ink">{money(mission.budget_amount,mission.currency_code)}</p><p className="mt-3 text-sm">Budget is supplied by the mission creator; it is not a record of spending.</p></Card></section>}
 {active==='Fundraising'&&<section id="funding-goal"><Card title="Funding goal"><p className="text-2xl text-ink">{money(mission.funding_goal_amount,mission.currency_code)}</p><p className="mt-3 text-sm">Funding tracking will be added later.</p></Card></section>}
 {active==='Participate'&&<section id="participants" className="rounded-[22px] border border-line bg-panel p-5 sm:p-6"><div className="flex items-center gap-3"><UserRoundPlus size={27} className="text-gold"/><div><h2 className="text-[25px] font-bold normal-case text-ink [font-stretch:normal]">Join SDG Mission</h2><p className="text-muted">Select one or more ways to contribute.</p></div></div><div className="mt-6 border-t border-line pt-6"><h3 className="mb-5 text-xl font-bold normal-case text-ink [font-stretch:normal]">{mission.title}</h3><MissionParticipationControl missionId={id} actors={actors} participations={mine??[]}/></div><div className="mt-6 space-y-3">{participants?.map(p=>{const actor=detail.get(p.actor_id);const label=participationOptions.find(o=>o.value===p.participation_kind)?.label||p.participation_kind;return <div key={p.actor_id+'-'+p.participation_kind} className="flex flex-wrap justify-between gap-2 rounded-lg border border-line p-3"><Link href={actor?.href||'/missions'} className="text-gold">{actor?.name||'Member'} · {label}</Link></div>})}</div></section>}
 {active==='Communication'&&<div id="posts" className="mx-auto max-w-3xl space-y-5"><PostComposer actors={participantActors} returnTo={base} missionId={id}/><FeedList posts={posts} actors={participantActors} returnTo={base}/>{posts.length===20&&<Link href={`${base}?tab=posts&before=${encodeURIComponent(posts[19].created_at)}&before_id=${posts[19].id}`} className="text-gold">Older posts →</Link>}{!participantActors.length&&<p className="text-sm text-muted">Join this mission to post updates.</p>}</div>}
 {active==='Communication'&&<section id="comments"><Card title="Recent comments"><div className="space-y-3">{comments?.map(c=><Link key={c.id} href={`/posts/${c.post_id}`} className="block rounded-lg border border-line p-3 text-ink hover:border-gold"><span className="text-sm text-gold">{commentActors.get(c.actor_id)?.name||'Member'} · {relativeDate(c.created_at)}</span><p className="mt-2 line-clamp-3 whitespace-pre-wrap">{c.body}</p></Link>)}{!comments?.length&&<p>No comments on recent mission posts yet.</p>}</div></Card></section>}
 {active==='Communication'&&<section id="messages"><Card title="Messages"><p>Contact the mission creator privately.</p>{creator&&<Link href={`/messages?to=${creator.id}`} className="mt-4 inline-block text-gold">Message {creator.name} →</Link>}</Card></section>}
 {active==='Participate'&&<section id="contributions"><ContributionList missionId={id}/></section>}
 {active==='Impact'&&<section id="proofs"><ProofList missionId={id}/></section>}
 {active==='Impact'&&<section id="verification"><Card title="Verification"><p>Proof reviews show the reviewer, method, reason and complete level history on each proof.</p><Link href={`${base}?tab=impact#proofs`} className="mt-4 inline-block text-gold">View mission proofs →</Link></Card></section>}
 {active==='Fundraising'&&<section id="donate"><MissionFundraising missionId={id}/></section>}
 {active==='Impact'&&<section id="impact"><ImpactView scope={{missionId:id}}/></section>}
 </div>;
}
