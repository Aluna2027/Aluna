import { MapPin, BookOpen, Target, ChartNoAxesColumnIncreasing, Pencil, UserRound, UsersRound, MessageCircle, MessagesSquare, Wallet, ShieldCheck, TrendingUp } from 'lucide-react';
import { DetailPageHeader, DetailSectionCard, DetailSdgIcons, DetailSdgRows, featuredSdg } from '@/components/detail-design-elements';
import { iconColors } from '@/lib/icon-colors';
import { MissionParticipationControl, MissionParticipationIcons } from '@/components/mission-participation-control';
import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ImpactView } from '@/components/impact-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, attachPostMedia, ownedActors, type FeedPost } from '@/lib/social';
import { getCity } from '@/lib/cities';
import { type Mission, missionTabs, missionTabFromSlug, money } from '@/lib/missions';
import { tabSlug } from '@/lib/profiles';
import { Card } from '@/components/ui';
import { ProfileTabs } from '@/components/profile-tabs';
import { PostComposer } from '@/components/post-composer';
import { FeedList } from '@/components/feed-list';
import { MissionFundraising } from '@/components/mission-fundraising';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { removeMission } from '../actions';
import { DirectorySdgIcon } from '@/components/directory-sdg-icon';
export default async function MissionPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;status?:string;error?:string;before?:string;before_id?:string}>}) {
 const {id}=await params;const {tab,status,error,before,before_id}=await searchParams;const client=await createClient();
 const {data:row}=await client.from('missions').select('*,places(name,source_key),mesh_communities(name)').eq('id',id).is('removed_at',null).maybeSingle();if(!row)notFound();
 const mission=row as unknown as Mission & {places:{name:string;source_key:string}|null;mesh_communities:{name:string}|null};
 const active=missionTabFromSlug(tab);const actors=await ownedActors();
 const [{data:participants},{data:mine}]=await Promise.all([client.from('mission_participations').select('actor_id,participation_kind,joined_at').eq('mission_id',id).order('joined_at',{ascending:true}).limit(2000),actors.length?client.from('mission_participations').select('actor_id,participation_kind').eq('mission_id',id).in('actor_id',actors.map(a=>a.id)):Promise.resolve({data:[]})]);
 const participantIds=[...new Set((participants??[]).map(p=>p.actor_id))];const detail=await actorDetails([...participantIds,mission.created_by_actor_id]);
 const grouped=new Map<string,{id:string;joinedAt:string;kinds:string[]}>();
 for(const participant of participants??[]){const current=grouped.get(participant.actor_id);if(current){if(!current.kinds.includes(participant.participation_kind))current.kinds.push(participant.participation_kind);if(participant.joined_at<current.joinedAt)current.joinedAt=participant.joined_at;}else grouped.set(participant.actor_id,{id:participant.actor_id,joinedAt:participant.joined_at,kinds:[participant.participation_kind]});}
 const orderedParticipants=[...grouped.values()].sort((a,b)=>a.joinedAt.localeCompare(b.joinedAt));
 const creatorParticipation=grouped.get(mission.created_by_actor_id);
 const canEdit=actors.some(a=>a.id===mission.created_by_actor_id);const participantActors=actors.filter(a=>a.id===mission.created_by_actor_id||mine?.some(p=>p.actor_id===a.id));
 const creator=detail.get(mission.created_by_actor_id);const city=mission.places?.source_key?getCity(mission.places.source_key):null;
 const manualPlace=mission.manual_place&&mission.manual_country?`${mission.manual_place}, ${mission.manual_country}`:null;
 const cursor=before&&!Number.isNaN(Date.parse(before))?before:null;
 const {data:feed}=active==='Communication'?await client.rpc('mission_feed_page',{p_mission:id,p_before:cursor,p_before_id:before_id||null,p_limit:20}):{data:null};
 const rawPosts=(feed??[]) as FeedPost[];
 const {data:postMedia}=active==='Communication'&&rawPosts.length?await client.from('posts').select('id,media_path,media_type').in('id',rawPosts.map(p=>p.id)):{data:[]};
 const mediaById=new Map((postMedia??[]).map(row=>[row.id,row]));
 const posts=await attachPostMedia(rawPosts.map(post=>({...post,...mediaById.get(post.id)})));
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
   <MissionParticipationControl missionId={id} actors={actors} participations={mine??[]} variant="detail"/>
   <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm text-muted"><UserRound size={19}/>Created by {creator?.name||'Member'}</p>{canEdit&&<Link href={base+'/edit'} className="inline-flex items-center gap-2 text-sm text-gold"><Pencil size={18}/>Edit Mission</Link>}</div>
   {canEdit&&<form action={removeMission} className="mt-2 text-right"><input type="hidden" name="id" value={id}/><ConfirmSubmitButton message="Are you sure you want to delete this SDG Mission?" className="text-xs text-[#E49BA3]">Delete SDG Mission</ConfirmSubmitButton></form>}
  </div>
 </header>
 <div className="grid gap-4 sm:grid-cols-2">
  <DetailSectionCard title="OVERVIEW" icon={<BookOpen size={24} color={iconColors.profile}/>}><p className="whitespace-pre-wrap">{mission.overview}</p></DetailSectionCard>
  <DetailSectionCard title="GOAL" icon={<Target size={24} color={iconColors.missions}/>}><p className="whitespace-pre-wrap">{mission.goal}</p></DetailSectionCard>
  <DetailSectionCard title="WHERE" icon={<MapPin size={24} color={iconColors.wifi}/>}><p>{manualPlace||(city?city.name+', '+city.country:mission.location_text)}</p>{city&&<Link href={'/cities/'+city.id+'?tab=missions'} className="mt-3 block text-base text-gold">View city →</Link>}{mission.community_id&&<Link href={'/communities/'+mission.community_id+'?tab=missions'} className="mt-3 block text-base text-gold">Linked Wi-Fi Mesh Community →</Link>}</DetailSectionCard>
  <DetailSectionCard title="AT A GLANCE" icon={<ChartNoAxesColumnIncreasing size={24} color={iconColors.connections}/>}><div className="space-y-3 text-base"><div className="flex justify-between gap-2"><span>Timeline</span><span className="text-right text-ink">{mission.starts_on&&mission.ends_on?mission.starts_on+' – '+mission.ends_on:mission.starts_on||mission.ends_on||'Not set'}</span></div><div className="flex justify-between gap-2"><span>Budget</span><span className="text-right text-ink">{money(mission.budget_amount,mission.currency_code)}</span></div><div className="flex justify-between gap-2"><span>Funding goal</span><span className="text-right text-gold">{money(mission.funding_goal_amount,mission.currency_code)}</span></div></div></DetailSectionCard>
 </div></>}
 {active==='Participate'&&<section id="team"><Card title={<span className="flex items-center gap-3"><UsersRound size={24} color={iconColors.missions}/>Team &amp; Roles</span>}><div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4"><div><p className="text-xs font-semibold uppercase text-gold">Mission Creator</p><Link href={creator?.href||'/missions'} className="font-semibold text-ink hover:text-gold">{creator?.name||'Member'}</Link></div><MissionParticipationIcons kinds={creatorParticipation?.kinds??[]}/></div>
  {orderedParticipants.filter(p=>p.id!==mission.created_by_actor_id).map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-0"><div><p className="text-xs uppercase text-muted">Team Member</p><Link href={detail.get(p.id)?.href||'/missions'} className="text-ink hover:text-gold">{detail.get(p.id)?.name||'Member'}</Link></div><MissionParticipationIcons kinds={p.kinds}/></div>)}
  {orderedParticipants.every(p=>p.id===mission.created_by_actor_id)&&<p>No team members yet.</p>}</div></Card></section>}
 {active==='Communication'&&<section id="messages"><Card title={<span className="flex items-center gap-3"><MessageCircle size={24} color={iconColors.profile}/>Messages</span>}><p>Contact the mission creator privately.</p>{creator&&<Link href={`/messages?to=${creator.id}`} className="mt-4 inline-block text-gold">Message {creator.name} →</Link>}</Card></section>}
 {active==='Communication'&&<div id="posts" className="w-full space-y-5">
  {participantActors.length>0&&<PostComposer actors={participantActors} returnTo={base} missionId={id}/>}
  {posts.length>0?<FeedList posts={posts} actors={participantActors} returnTo={base}/>:<Card title={<span className="flex items-center gap-3"><MessagesSquare size={24} color="#35F3FF"/>No posts yet</span>}><p>There are no posts for this mission yet.</p></Card>}
  {posts.length===20&&<Link href={`${base}?tab=communication&before=${encodeURIComponent(posts[19].created_at)}&before_id=${posts[19].id}`} className="text-gold">Older posts →</Link>}
  {!participantActors.length&&<p className="text-sm text-muted">Join this mission to post updates.</p>}</div>}
 {active==='Fundraising'&&<section id="budget"><Card title={<span className="flex items-center gap-3"><Wallet size={24} color={iconColors.missions}/>Budget</span>}><p className="text-2xl text-ink">{money(mission.budget_amount,mission.currency_code)}</p><p className="mt-3 text-sm">Budget is supplied by the mission creator; it is not a record of spending.</p></Card></section>}
 {active==='Fundraising'&&<section id="funding-goal"><Card title={<span className="flex items-center gap-3"><Target size={24} color={iconColors.wifi}/>Funding Goal</span>}><p className="text-2xl text-ink">{money(mission.funding_goal_amount,mission.currency_code)}</p></Card></section>}
 {active==='Fundraising'&&<section id="donate"><MissionFundraising missionId={id}/></section>}
 {active==='Impact'&&<section id="proofs"><ProofList missionId={id} iconColor={iconColors.proofs}/></section>}
 {active==='Impact'&&<section id="verification"><Card title={<span className="flex items-center gap-3"><ShieldCheck size={24} color={iconColors.verification}/>Verification</span>}><p>Proof reviews show the reviewer, method, reason and complete level history on each proof.</p><Link href={`${base}?tab=impact#proofs`} className="mt-4 inline-block text-gold">View mission proofs →</Link></Card></section>}
 {active==='Impact'&&<section id="contributions"><ContributionList missionId={id} iconColor={iconColors.missions}/></section>}
 {active==='Impact'&&<section id="impact"><div className="mb-4 flex items-center gap-3 text-lg font-semibold text-ink"><TrendingUp size={24} color={iconColors.impact}/>Impact</div><ImpactView scope={{missionId:id}} metricIconColor={iconColors.impact}/></section>}
 </div>;
}
