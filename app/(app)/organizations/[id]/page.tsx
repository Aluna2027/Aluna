import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Placeholder } from '@/components/ui';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileTabs } from '@/components/profile-tabs';
import { ContributionList } from '@/components/contribution-list';
import { ActorMissions } from '@/components/actor-missions';
import { ProofList } from '@/components/proof-list';
import { ActorFundraising } from '@/components/actor-fundraising';
import { ActorCommunities } from '@/components/actor-communities';
import { ActorSocial } from '@/components/actor-social';
import { type Organization, organizationTabs, tabSlug } from '@/lib/profiles';

export default async function OrganizationPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;status?:string}>}) {
 const {id}=await params;const {tab,status}=await searchParams;const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:org}=await client.from('organizations').select('id,name,organization_type,description,is_verified,logo_url,location_text,website,wba_total_score,wba_human_rights_score,wba_decent_work_score,wba_acting_ethically_score').eq('id',id).maybeSingle();if(!org)notFound();
 const organization=org as Organization;const tabs=organizationTabs[organization.organization_type];if(!tabs)notFound();
 const active=tabs.find(label=>tabSlug(label)===tab)??'About';
 const {data:membership}=await client.from('organization_members').select('member_role').eq('organization_id',id).eq('profile_id',user.id).maybeSingle();
 const isAdmin=membership?.member_role==='admin';
 const {data:actor}=await client.from('actors').select('id').eq('organization_id',id).maybeSingle();
 const {data:people}=active==='People'?await client.from('organization_members').select('profile_id,member_role,profiles(display_name)').eq('organization_id',id):{data:null};
 const scores=organization.organization_type==='company'?[
   {label:'Total Score',value:organization.wba_total_score},
   {label:'Respecting Human Rights',value:organization.wba_human_rights_score},
   {label:'Providing and Promoting Decent Work',value:organization.wba_decent_work_score},
   {label:'Acting Ethically',value:organization.wba_acting_ethically_score},
 ]:[];
 return <div className="space-y-6"><Link href="/organizations" className="text-sm text-gold hover:underline">← Organizations</Link>{status==='saved'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Organization saved.</p>}
 <ProfileHeader name={organization.name} kind={organization.organization_type} location={organization.location_text} website={organization.website} imageUrl={organization.logo_url} unverified={!organization.is_verified} editHref={isAdmin?`/organizations/${id}/edit`:undefined} scores={scores}/>
 <ProfileTabs base={`/organizations/${id}`} tabs={tabs} active={tabSlug(active)}/>
 {active==='About'?<><Card title="About"><p className="whitespace-pre-wrap">{organization.description||'This organization has not added an introduction yet.'}</p></Card>{actor&&<ActorSocial actorId={actor.id} section="About" returnTo={`/organizations/${id}`}/>}</>:active==='People'?<Card title="People"><div className="space-y-3">{people?.map(person=>{const profile=person.profiles as unknown as {display_name:string}|null;return <Link key={person.profile_id} href={`/people/${person.profile_id}`} className="block rounded-xl border border-line p-3 text-ink hover:border-gold">{profile?.display_name||'Member'} <span className="text-sm text-muted">· {person.member_role}</span></Link>})}{!people?.length&&<p>No members yet.</p>}</div></Card>:active==='Wi-Fi Mesh Communities'&&actor?<ActorCommunities actorId={actor.id}/>:active==='Missions'&&actor?<ActorMissions actorId={actor.id}/>:active==='Fundraising'&&actor?<ActorFundraising actorId={actor.id}/>:active==='Contributions'&&actor?<ContributionList actorId={actor.id}/>:active==='Proofs'&&actor?<ProofList actorId={actor.id}/>:actor&&['Posts','Connections'].includes(active)?<ActorSocial actorId={actor.id} section={active} returnTo={`/organizations/${id}`}/>:<Placeholder title={active} description={`${active} for ${organization.name} will appear here in a later phase.`}/>}
 </div>;
}
