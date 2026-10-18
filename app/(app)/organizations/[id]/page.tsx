import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Placeholder } from '@/components/ui';
import { iconColors } from '@/lib/icon-colors';
import { UsersRound, Wifi, Target, HandCoins } from 'lucide-react';
import { ProfileCommunityCards, ProfileMissionCards, ProfileFundraisingCards } from '@/components/profile-directory-cards';
import { OrganizationPosts } from '@/components/organization-posts';
import { OrganizationImpact } from '@/components/organization-impact';
import { OrganizationMembers } from '@/components/organization-members';
import { OrganizationRelationshipCards } from '@/components/organization-relationships';
import { ProfileHeader, WbaScorePanel } from '@/components/profile-header';
import { SocialProfileTabs } from '@/components/social-profile-tabs';
import { ActorSocial, ActorSocialActions } from '@/components/actor-social';
import { type Organization, organizationTabs, tabSlug } from '@/lib/profiles';
import { removeOrganization } from '../actions';
import { ArchiveOrganizationConfirmation } from '@/components/archive-organization-confirmation';
import { claimOrganization, verifyClaimDns } from '../access/actions';
import { adminDb } from '@/lib/org-access';

export default async function OrganizationPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;status?:string;error?:string;manage?:string;page?:string}>}) {
 const {id}=await params;const {tab,status,error,manage,page}=await searchParams;const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:org}=await client.from('organizations').select('id,name,organization_type,country,description,is_verified,logo_url,location_text,website,wba_total_score,wba_human_rights_score,wba_decent_work_score,wba_acting_ethically_score,management_type').eq('id',id).is('removed_at',null).maybeSingle();if(!org)notFound();
 const organization=org as Organization;const tabs=organizationTabs[organization.organization_type];if(!tabs)notFound();
 const legacyAliases:Record<string,string>={about:'profile',people:'members','wi-fi-mesh-communities':'wi-fi-mesh',contributions:'impact',proofs:'impact',research:'profile',projects:'missions',funding:'fundraising',sponsorship:'connections',partnerships:'connections'};
 const slug=legacyAliases[tab??'']??tab;
 const active=tabs.find(label=>tabSlug(label)===(slug||'profile'))??'Profile';
 const {data:membership}=await client.from('organization_members').select('member_role').eq('organization_id',id).eq('profile_id',user.id).maybeSingle();
 const isAdmin=membership?.member_role==='admin';
 const isManaging=isAdmin&&manage==='1';
 const pageNumber=Math.min(1000,Math.max(0,Number.parseInt(page||'0',10)||0));
 const {data:canArchive}=await client.rpc('can_archive_organization',{p_organization:id});
 const {data:admins}=await client.from('organization_members').select('profile_id').eq('organization_id',id).eq('member_role','admin').limit(1);
 const accessDb=adminDb();
 const {data:requests}=await accessDb.from('organization_claim_requests').select('id,status,domain,challenge').eq('organization_id',id).eq('requester_id',user.id).in('status',['needs_review','dns_pending']).order('created_at',{ascending:false}).limit(1);
 const pendingClaim=requests?.[0];
 const {data:actor}=await client.from('actors').select('id').eq('organization_id',id).maybeSingle();
 
 const scores=organization.organization_type==='company'?[
   {label:'Total Score',value:organization.wba_total_score},
   {label:'Respecting Human Rights',value:organization.wba_human_rights_score},
   {label:'Providing and Promoting Decent Work',value:organization.wba_decent_work_score},
   {label:'Acting Ethically',value:organization.wba_acting_ethically_score},
 ]:[];
 return <div className="space-y-6">{status==='deleted'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Item deleted.</p>}{status==='archived'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Item archived.</p>}{error==='delete'&&<p role="alert" className="rounded-lg border border-red-700 p-3 text-red-300">This item cannot be deleted because of permissions or protected activity.</p>}{error==='not-authorized'&&<p role="alert" className="rounded-lg border border-red-700 p-3 text-red-300">Only an organization administrator can manage this item.</p>}{status==='saved'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Organization saved.</p>}{status==='archived'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Organization archived.</p>}{error==='archive'&&<p role="alert" className="rounded-lg border border-red-700 p-3 text-red-300">This organization could not be archived. Nothing was changed.</p>}{status==='membership-requested'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Membership request submitted for administrator review.</p>}{status==='member-reviewed'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Membership request reviewed.</p>}{status==='relationship-saved'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Relationship saved.</p>}{status==='relationship-deleted'&&<p role="status" className="rounded-lg border border-gold p-3 text-gold">Relationship deleted.</p>}{['membership','review','relationship'].includes(error??'')&&<p role="alert" className="rounded-lg border border-red-700 p-3 text-red-300">This action could not be completed. Check permissions and try again.</p>}{['follow','connection'].includes(error??'')&&<p role="alert" className="rounded-lg border border-red-700 p-3 text-red-300">Could not update your relationship. Please try again.</p>}

 <SocialProfileTabs base={`/organizations/${id}`} tabs={tabs} active={tabSlug(active)} actorId={actor?.id} tabsFirst manage={isManaging}/>
 {active!=='Profile'&&<div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3"><Link href={`/organizations/${id}?tab=profile`} className="flex h-10 w-10 items-center justify-center rounded-full bg-panel-raised text-[#26E7D4]" aria-label="Organization profile"><UsersRound size={20}/></Link><div className="min-w-0 flex-1"><Link href={`/organizations/${id}?tab=profile`} className="block truncate font-semibold text-ink">{organization.name}</Link><p className="text-xs text-muted">{organization.organization_type} · {organization.country||'Global'}</p></div>{isManaging&&<Link href={`/organizations/${id}/manage`} className="text-sm text-gold">Manage</Link>}</div>}

 {active==='Profile'?<>
 <ProfileHeader name={organization.name} kind={organization.organization_type} country={organization.country} location={organization.location_text} website={organization.website} imageUrl={organization.logo_url} editHref={undefined}>
  {actor&&<ActorSocialActions actorId={actor.id} profilePath={`/organizations/${id}`}/>}
 </ProfileHeader>
 <Card title="Organization access"><div className="space-y-3">
 {status==='claim-pending'&&<p role="status" className="text-gold">Your claim request has been submitted.</p>}
 {status==='claim-approved'&&<p role="status" className="text-gold">Organization access granted.</p>}
 {status==='invitation-accepted'&&<p role="status" className="text-gold">Invitation accepted. You can manage this organization.</p>}
 {error==='claim'&&<p role="alert" className="text-red-300">Unable to submit or approve this claim.</p>}
 {error==='dns'&&<p role="alert" className="text-red-300">DNS verification is not complete. Check the TXT record and try again.</p>}
 {isAdmin?<Link className="inline-block rounded-lg border border-gold px-4 py-2 text-gold" href={`/organizations/${id}/manage`}>Manage Organization</Link>
 :pendingClaim?<><p className="text-sm text-muted">Request Pending — verification in progress.</p>
 {pendingClaim.status==='dns_pending'&&pendingClaim.challenge&&<div className="space-y-3"><p className="text-sm">To prove control of the approved domain, ask its DNS administrator to publish this TXT record:</p><code className="block break-all rounded-lg bg-panel-raised p-3 text-xs">_aluna-claim.{pendingClaim.domain} TXT &quot;aluna-claim={pendingClaim.challenge}&quot;</code><form action={verifyClaimDns}><input type="hidden" name="claim_id" value={pendingClaim.id}/><button className="rounded-lg bg-gold px-4 py-2 font-semibold text-navy">Verify DNS</button></form></div>}
 </>
 :admins?.length?<p className="text-sm text-muted">This organization is already managed. Please contact its administrators to request an invitation.</p>
 :<details><summary className="cursor-pointer text-gold">Claim Organization</summary><p className="my-3 text-sm text-muted">Use a verified Aluna account with your official organization email address. Domain ownership or a manual authorization review is required before management access can be granted.</p><form action={claimOrganization}><input type="hidden" name="organization_id" value={id}/><button className="rounded-lg bg-gold px-4 py-2 font-semibold text-navy">Submit Claim Request</button></form></details>}
 </div></Card>
<Card title="About" iconColor={iconColors.missions}><p className="whitespace-pre-wrap">{organization.description||'This organization has not added an introduction yet.'}</p></Card>{scores.length>0&&<WbaScorePanel scores={scores}/>}
 {canArchive&&<ArchiveOrganizationConfirmation><form action={removeOrganization} data-archive-organization data-organization-name={organization.name} className="flex justify-end"><input type="hidden" name="id" value={id}/><input type="hidden" name="return_to" value="profile"/><button type="submit" className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-300">Archive organization</button></form></ArchiveOrganizationConfirmation>}
 </>:active==='Members'?<OrganizationMembers organizationId={id} isAdmin={isAdmin} managing={isManaging}/>
 :active==='Wi-Fi Mesh'&&actor?<section className="space-y-4">{isManaging&&<Link href={`/communities/new?organization=${id}`} className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-semibold text-navy"><Wifi size={18}/>Create Wi-Fi Mesh Community</Link>}<ProfileCommunityCards actorId={actor.id} createdOnly page={pageNumber} paginationBase={`/organizations/${id}?tab=wi-fi-mesh${isManaging?'&manage=1':''}`} manageOrganizationId={isManaging?id:undefined}/></section>
 :active==='Missions'&&actor?<section className="space-y-4">{isManaging&&<Link href={`/missions/new?organization=${id}`} className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-semibold text-navy"><Target size={18}/>Create SDG Mission</Link>}<ProfileMissionCards actorId={actor.id} createdOnly page={pageNumber} paginationBase={`/organizations/${id}?tab=missions${isManaging?'&manage=1':''}`} manageOrganizationId={isManaging?id:undefined}/></section>
 :active==='Fundraising'&&actor?<section className="space-y-4">{isManaging&&<Link href={`/fundraising/campaigns/new?organization=${id}`} className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-semibold text-navy"><HandCoins size={18}/>Create Campaign</Link>}<ProfileFundraisingCards actorId={actor.id} createdOnly page={pageNumber} paginationBase={`/organizations/${id}?tab=fundraising${isManaging?'&manage=1':''}`} manageOrganizationId={isManaging?id:undefined}/></section>
 :active==='Posts'&&actor?<OrganizationPosts actorId={actor.id} name={organization.name} kind={organization.organization_type} isAdmin={isAdmin} organizationId={id}/>
 :active==='Connections'&&actor?<div className="space-y-5"><ActorSocial actorId={actor.id} section="Connections" organizationView/>{organization.organization_type==='company'&&<OrganizationRelationshipCards organizationId={id} isAdmin={isAdmin} managing={isManaging}/>}</div>
 :active==='Following'&&actor?<ActorSocial actorId={actor.id} section="Following" organizationView/>
 :active==='Impact'&&actor?<OrganizationImpact actorId={actor.id}/>
 :<Placeholder title={active} description={`${active} for ${organization.name} will appear here in a later phase.`}/>}

 </div>;
}
