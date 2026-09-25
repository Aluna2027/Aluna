import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ActorMissions } from '@/components/actor-missions';
import Link from 'next/link';
import { ActorFundraising } from '@/components/actor-fundraising';
import { ActorCommunities } from '@/components/actor-communities';
import { ActorSocial } from '@/components/actor-social';
import { Card, Placeholder } from '@/components/ui';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileTabs } from '@/components/profile-tabs';
import { type PublicProfile, tabSlug, userTabs } from '@/lib/profiles';
export function UserProfile({profile,tab,isOwner=false,actorId}:{profile:PublicProfile;tab?:string;isOwner?:boolean;actorId?:string}) {
 const active=userTabs.find(t=>tabSlug(t)===tab)??'About';
 const href=`/people/${profile.id}`;
 return <div className="space-y-6"><ProfileHeader name={profile.display_name||'Aluna member'} kind="User" location={profile.location_text} website={profile.website} imageUrl={profile.avatar_url} editHref={isOwner?'/profile/edit':undefined}/><ProfileTabs base={href} tabs={userTabs} active={tabSlug(active)}/>
 {active==='About'?<><Card title="About"><p className="whitespace-pre-wrap">{profile.bio||'This member has not added an introduction yet.'}</p>{profile.skills?.length?<p className="mt-4 text-sm"><span className="text-ink">Skills:</span> {profile.skills.join(' · ')}</p>:null}{profile.interests?.length?<p className="mt-2 text-sm"><span className="text-ink">Interests:</span> {profile.interests.join(' · ')}</p>:null}</Card>{actorId&&<ActorSocial actorId={actorId} section="About" returnTo={href}/>}</>:active==='Wi-Fi Mesh Communities'&&actorId?<ActorCommunities actorId={actorId}/>:active==='Missions'&&actorId?<ActorMissions actorId={actorId}/>:active==='Fundraising'&&actorId?<ActorFundraising actorId={actorId}/>:active==='Contributions'&&actorId?<ContributionList actorId={actorId}/>:active==='Proofs'&&actorId?<ProofList actorId={actorId}/>:active==='Donations'&&isOwner?<Card title="Your donations"><p className="mb-4">Your payments and receipts are private.</p><Link href="/donations" className="text-gold">View my donations →</Link></Card>:actorId&&['Posts','Connections','Followers','Following'].includes(active)?<ActorSocial actorId={actorId} section={active} returnTo={href}/>:<Placeholder title={active} description={`${active} will appear here in a later phase.`}/>}</div>;
}
