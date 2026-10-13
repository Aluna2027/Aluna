import { ContributionList } from '@/components/contribution-list';
import { ProofList } from '@/components/proof-list';
import { ActorMissions } from '@/components/actor-missions';
import Link from 'next/link';
import { ActorFundraising } from '@/components/actor-fundraising';
import { ActorCommunities } from '@/components/actor-communities';
import { ActorSocial, ActorSocialActions } from '@/components/actor-social';
import { Card, Placeholder } from '@/components/ui';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileTabs } from '@/components/profile-tabs';
import { type PublicProfile, tabSlug, userTabs } from '@/lib/profiles';

export function UserProfile({profile,tab,isOwner=false,actorId,base,error}:{profile:PublicProfile;tab?:string;isOwner?:boolean;actorId?:string;base?:string;error?:string}) {
 const active=userTabs.find(t=>tabSlug(t)===tab)??'About';
 const href=base??`/people/${profile.id}`;
 const role=profile.aluna_role?profile.aluna_role.charAt(0).toUpperCase()+profile.aluna_role.slice(1):null;
 const fullName=[profile.first_name,profile.last_name].filter(Boolean).join(' ');
 return <div className="space-y-6"><ProfileHeader name={profile.display_name||'Aluna member'} kind="User" location={profile.location_text} website={profile.website} imageUrl={profile.avatar_url} editHref={isOwner?'/profile/edit':undefined}/>{actorId&&<ActorSocialActions actorId={actorId} profilePath={href}/>}<ProfileTabs base={href} tabs={userTabs} active={tabSlug(active)}/>
 {['follow','connection'].includes(error??'')&&<p role="alert" className="rounded-lg border border-red-700 p-3 text-sm text-red-300">Could not update your relationship. Please try again.</p>}
 {active==='About'?<><Card title="About">{fullName&&<p className="mb-2 text-sm"><span className="text-ink">Name:</span> {fullName}</p>}{role&&<p className="mb-3 text-sm"><span className="text-ink">Role:</span> <span className="text-gold">{role}</span></p>}<p className="whitespace-pre-wrap">{profile.bio||'This member has not added an introduction yet.'}</p>{profile.skills?.length?<p className="mt-4 text-sm"><span className="text-ink">Skills:</span> {profile.skills.join(' · ')}</p>:null}{profile.interests?.length?<p className="mt-2 text-sm"><span className="text-ink">Interests:</span> {profile.interests.join(' · ')}</p>:null}</Card></>:active==='Wi-Fi Mesh Communities'&&actorId?<ActorCommunities actorId={actorId}/>:active==='Missions'&&actorId?<ActorMissions actorId={actorId}/>:active==='Fundraising'&&actorId?<ActorFundraising actorId={actorId}/>:active==='Contributions'&&actorId?<ContributionList actorId={actorId}/>:active==='Proofs'&&actorId?<ProofList actorId={actorId}/>:active==='Donations'&&isOwner?<Card title="Your donations"><p className="mb-4">Your payments and receipts are private.</p><Link href="/donations" className="text-gold">View my donations →</Link></Card>:actorId&&['Posts','Connections','Followers','Following'].includes(active)?<ActorSocial actorId={actorId} section={active}/>:<Placeholder title={active} description={`${active} will appear here in a later phase.`}/>}</div>;
}
