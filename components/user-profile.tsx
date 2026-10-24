import { OrganizationImpact } from '@/components/organization-impact';
import { ActorMissions } from '@/components/actor-missions';
import Link from 'next/link';
import { ActorFundraising } from '@/components/actor-fundraising';
import { ActorCommunities } from '@/components/actor-communities';
import { ActorSocial, ActorSocialActions } from '@/components/actor-social';
import { Card, Placeholder } from '@/components/ui';
import { ProfileHeader } from '@/components/profile-header';
import { PostComposer } from '@/components/post-composer';
import { ownedActors } from '@/lib/social';
import { SocialProfileTabs } from '@/components/social-profile-tabs';
import { type PublicProfile, tabSlug, userTabs } from '@/lib/profiles';
import { CheckCircle2, MessageCircle, UsersRound } from 'lucide-react';

export async function UserProfile({profile,tab,isOwner=false,actorId,base,error}:{profile:PublicProfile;tab?:string;isOwner?:boolean;actorId?:string;base?:string;error?:string}) {
 const availableTabs=isOwner?userTabs:userTabs.filter(t=>t!=='Donations');
 const requestedTab=tab==='contributions'||tab==='proofs'?'impact':tab;
 const active=availableTabs.find(t=>tabSlug(t)===requestedTab)??'About';
 const href=base??`/people/${profile.id}`;
 const ownProfile=isOwner&&href==='/profile';
 const role=profile.aluna_role?profile.aluna_role.charAt(0).toUpperCase()+profile.aluna_role.slice(1):null;
 const fullName=[profile.first_name,profile.last_name].filter(Boolean).join(' ');
 const composerActors=isOwner&&actorId&&active==='Posts'?(await ownedActors()).filter(a=>a.id===actorId):[];
 return <div className="space-y-6">
  <SocialProfileTabs base={href} tabs={availableTabs} active={tabSlug(active)} actorId={actorId} tabsFirst/>
  {['follow','connection'].includes(error??'')&&<p role="alert" className="rounded-lg border border-red-700 bg-panel p-3 text-sm text-red-300">Could not update your relationship. Please try again.</p>}
  {active==='About'?<>
   <ProfileHeader name={profile.display_name||'Aluna member'} kind="User" location={profile.location_text} website={profile.website} imageUrl={profile.avatar_url} editHref={isOwner?'/profile/edit':undefined}/>
   {actorId&&(isOwner
    ?<section aria-label="Profile shortcuts" className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-4 text-sm">
      <Link href={href+'?tab=connections'} className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel-raised px-4 py-2 font-medium text-ink hover:bg-nav-active"><CheckCircle2 size={17} className="text-[#26E7D4]"/>Connected</Link>
      <Link href={href+'?tab=following'} className="inline-flex items-center gap-2 rounded-lg border border-gold px-4 py-2 font-medium text-gold hover:bg-gold/10"><UsersRound size={17} className="text-[#26E7D4]"/>Following</Link>
      <Link href="/messages" className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-navy hover:opacity-90"><MessageCircle size={16}/>Message</Link>
     </section>
    :<ActorSocialActions actorId={actorId} profilePath={href}/>)}
   <Card title="About">
    {fullName&&<p className="mb-2 text-sm"><span className="text-ink">Name:</span> {fullName}</p>}
    {role&&<p className="mb-3 text-sm"><span className="text-ink">Role:</span> <span className="text-gold">{role}</span></p>}
    <p className="whitespace-pre-wrap">{profile.bio||'This member has not added an introduction yet.'}</p>
    {profile.skills?.length?<p className="mt-4 text-sm"><span className="text-ink">Skills:</span> {profile.skills.join(' · ')}</p>:null}
    {profile.interests?.length?<p className="mt-2 text-sm"><span className="text-ink">Interests:</span> {profile.interests.join(' · ')}</p>:null}
   </Card>
   {ownProfile&&<Card title="The First 340"><p className="mb-3">Apply for the special global team program from your existing Aluna profile.</p><Link href="/first-340" className="text-gold">Apply for The First 340 →</Link></Card>}
  </>:active==='Wi-Fi Mesh Communities'&&actorId?<ActorCommunities actorId={actorId}/>
  :active==='Missions'&&actorId?<ActorMissions actorId={actorId}/>
  :active==='Fundraising'&&actorId?<ActorFundraising actorId={actorId}/>
  :active==='Impact'&&actorId?<OrganizationImpact actorId={actorId} subject="profile"/>
  :active==='Donations'&&isOwner?<Card title="Your donations"><p className="mb-4">Your payments and receipts are private.</p><Link href="/donations" className="text-gold">View my donations →</Link></Card>
  :actorId&&['Posts','Connections','Followers','Following'].includes(active)?<>
   {isOwner&&active==='Posts'&&composerActors.length>0&&<PostComposer actors={composerActors} returnTo={href+'?tab=posts'}/>}
   <ActorSocial actorId={actorId} section={active}/>
  </>:<Placeholder title={active} description={active+' will appear here in a later phase.'}/>}
 </div>;
}
