import { randomUUID } from 'crypto';
import { MapPin, BookOpen, UsersRound, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { DetailPageHeader, DetailSectionCard, DetailSdgRows, featuredSdg } from '@/components/detail-design-elements';
import { DirectorySdgIcon } from '@/components/directory-sdg-icon';
import { CampaignDonationFields } from '@/components/campaign-donation-fields';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, ownedActors, relativeDate } from '@/lib/social';
import { Progress, campaignTotal, type Total, type Campaign } from '@/lib/fundraising';
import { money } from '@/lib/missions';
import { getCity } from '@/lib/cities';
import { sdgLabel } from '@/lib/sdgs';
import { Card } from '@/components/ui';
import { ReferralShare } from '@/components/referral-share';
import { DonationForm } from '@/components/donation-form';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { createCampaignReferralLink, setCampaignReferralStatus, removeOrArchiveCampaign } from '../../actions';

type CampaignReferralReportRow={link_id:string;token:string;label:string;source_type:string;assigned_actor_id:string|null;assigned_name:string|null;is_active:boolean;created_at:string;clicks:number;checkouts:number;donor_count:number;donations_attributed:number;amount_raised:number;average_donation:number};

const referralTypes=[
 ['influencer','Influencer'],['partner','Partner'],['team_member','Team member'],['university','University'],['ngo','NGO'],['company','Company'],['social','Social'],['qr','QR'],['newsletter','Newsletter'],['event','Event'],['other','Other'],
] as const;

export default async function CampaignPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{referral_status?:string;referral_error?:string;remove_error?:string}>}){
 const {id}=await params;const {referral_status,referral_error,remove_error}=await searchParams;const client=await createClient();
 const {data}=await client.from('fundraising_campaigns').select('*,missions(title,manual_place,manual_country,places(name,source_key))').eq('id',id).is('removed_at',null).maybeSingle();if(!data)notFound();
 const campaign=data as Campaign & {archived_at:string|null;missions:{title:string;manual_place:string|null;manual_country:string|null;places:{name:string;source_key:string}|null}|null};
 const missionCity=campaign.missions?.places?.source_key?getCity(campaign.missions.places.source_key):null;const missionLocation=campaign.missions?.manual_place&&campaign.missions?.manual_country?`${campaign.missions.manual_place}, ${campaign.missions.manual_country}`:missionCity?`${missionCity.name}, ${missionCity.country}`:campaign.missions?.places?.name??null;
 const [{data:fundraisers},{data:totals}]=await Promise.all([
  client.from('fundraisers').select('id,slug,title,kind,actor_id,goal_amount').eq('campaign_id',id).order('created_at',{ascending:false}).limit(100),
  client.rpc('fundraising_totals',{p_campaign:id})
 ]);
 const summary=campaignTotal((totals??[]) as Total[]);const byFundraiser=new Map(((totals??[]) as Total[]).map(t=>[t.fundraiser_id,t]));
 const actors=await actorDetails([campaign.actor_id,...(fundraisers??[]).map(f=>f.actor_id)]);const mine=await ownedActors();const canEdit=mine.some(a=>a.id===campaign.actor_id);
 let referralRows:CampaignReferralReportRow[]=[];let assignable:{id:string;name:string;kind:string}[]=[];
 if(canEdit){
  const [{data:report},{data:actorRows}]=await Promise.all([
   client.rpc('campaign_referral_report',{p_campaign:id}),
   client.from('actors').select('id,profile_id,organization_id').limit(200)
  ]);
  referralRows=(report??[]) as CampaignReferralReportRow[];
  const details=await actorDetails((actorRows??[]).map(a=>a.id));
  assignable=[...details.values()].sort((a,b)=>a.name.localeCompare(b.name));
 }
 const archived=Boolean(campaign.archived_at);
 const totalReferral=referralRows.reduce((v,r)=>({clicks:v.clicks+Number(r.clicks||0),donors:v.donors+Number(r.donor_count||0),amount:v.amount+Number(r.amount_raised||0)}),{clicks:0,donors:0,amount:0});
 const {data:campaignSdgs}=await client.from('mission_sdgs').select('sdg_number').eq('mission_id',campaign.mission_id).order('sdg_number');
 const {data:{user}}=await client.auth.getUser();
 const {data:visitor}=user?await client.from('profiles').select('display_name').eq('id',user.id).maybeSingle():{data:null};
 const visitorName=visitor?.display_name||user?.email?.split('@')[0]||'member';
 return <div className="space-y-6">
  <DetailPageHeader kind="SDG FUNDRAISING" title={campaign.title} backHref="/fundraising" backLabel="Fundraising" visitorName={visitorName}/>
  {referral_status&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Referral link {referral_status}.</p>}
  {remove_error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not delete this campaign. Please try again.</p>}
  {archived&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">This campaign is archived. Its financial and referral history is preserved.</p>}
  {referral_error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not update the referral link. Check the details and try again.</p>}
  <header className="rounded-[22px] border border-line bg-panel p-5 sm:p-6">
   <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-3"><span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#173638] sm:size-16"><DirectorySdgIcon number={featuredSdg((campaignSdgs??[]).map(s=>s.sdg_number),true)} size={29}/></span><div><p className="text-sm font-semibold text-gold">SDG MISSION CAMPAIGN</p><h2 className="mt-2 break-words text-[23px] font-bold normal-case leading-tight text-ink [font-stretch:normal] sm:text-[27px]">{campaign.title}</h2></div></div>
    <div className="flex gap-3">{(campaignSdgs??[]).map(s=>s.sdg_number).filter(n=>n!==featuredSdg((campaignSdgs??[]).map(s=>s.sdg_number),true)).map(n=><DirectorySdgIcon key={n} number={n} size={24}/>)}</div>
   </div>
   <p className="mt-7 flex items-center gap-3 text-base text-muted"><MapPin className="shrink-0 text-[#26E7D4]" size={20}/>{missionLocation||'Location not reported'} · <Link href={'/missions/'+campaign.mission_id} className="hover:text-gold hover:underline">{campaign.missions?.title||'SDG Mission'}</Link></p>
   <div className="mt-6 text-base leading-relaxed sm:text-lg"><DetailSdgRows numbers={(campaignSdgs??[]).map(s=>s.sdg_number)} primary={featuredSdg((campaignSdgs??[]).map(s=>s.sdg_number),true)}/></div>
   <div className="mt-8 border-t border-line pt-8">
    <div className="flex items-baseline justify-between gap-4"><strong className="text-[32px] font-bold text-gold sm:text-[38px]">{money(summary.amount,campaign.currency_code)}</strong><strong className="text-[28px] font-bold text-[#26E7D4]">{Number(campaign.goal_amount)>0?Math.min(100,Math.round(summary.amount/Number(campaign.goal_amount)*100)):0}%</strong></div>
    <div className="mt-1 flex justify-between gap-4 text-sm text-muted sm:text-base"><span>Raised of {money(Number(campaign.goal_amount),campaign.currency_code)}</span><span>{summary.count} confirmed donors</span></div>
    <div role="progressbar" aria-label="Campaign funding progress" aria-valuenow={Number(campaign.goal_amount)>0?Math.min(100,Math.round(summary.amount/Number(campaign.goal_amount)*100)):0} aria-valuemin={0} aria-valuemax={100} className="mt-5 h-[14px] overflow-hidden rounded-full bg-[#2A3040]"><div className="h-full rounded-full bg-[#26E7D4]" style={{width:(Number(campaign.goal_amount)>0?Math.min(100,Math.round(summary.amount/Number(campaign.goal_amount)*100)):0)+'%'}}/></div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
     {!archived&&<div className="min-w-0 [&_button]:!bg-transparent [&_button]:!px-0 [&_button]:!py-0 [&_button]:!text-base [&_button]:!font-medium [&_button]:!text-[#FF4FD8]"><ReferralShare path={'/c/'+id} title={campaign.title}/></div>}
     <div className="flex flex-wrap gap-3 text-sm"><Link href={'/missions/'+campaign.mission_id} className="text-gold">View SDG Mission →</Link><span className="text-muted">Campaign details</span></div>
    </div>
   </div>
  </header>
  <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
   <div className="order-2 space-y-4 lg:order-1 lg:col-start-1 lg:row-start-1">
    <DetailSectionCard title="CAMPAIGN STORY" icon={<BookOpen size={25} color="#A78BFA"/>}><p className="whitespace-pre-wrap">{campaign.story}</p></DetailSectionCard>
    <DetailSectionCard title="FUNDRAISERS" icon={<UsersRound size={25} color="#26E7D4"/>}><div className="space-y-3">{fundraisers?.map(f=>{const total=byFundraiser.get(f.id);return <Link key={f.id} href={'/fundraising/'+f.slug} className="block rounded-xl border border-line p-4 hover:border-gold"><p className="text-gold">{f.title} · {f.kind==='team'?'Team':'Personal'}</p><p className="my-2 text-xs">By {actors.get(f.actor_id)?.name}</p><Progress amount={Number(total?.amount_raised??0)} count={Number(total?.donor_count??0)} goal={Number(f.goal_amount)} currency={campaign.currency_code}/></Link>})}{!fundraisers?.length&&<div className="rounded-xl bg-[#191E2A] p-4"><p>No fundraisers yet.</p><Link href={'/fundraising/new?campaign='+id} className="mt-3 block text-base font-semibold text-gold">+ Start the first fundraiser</Link></div>}</div></DetailSectionCard>
    {canEdit&&<section className="rounded-[20px] border border-line bg-panel p-5"><h2 className="flex items-center gap-3 text-xl font-bold uppercase text-ink [font-stretch:normal]"><ChartNoAxesColumnIncreasing size={23} className="text-gold"/>CAMPAIGN MANAGEMENT</h2><p className="mt-4 text-sm text-muted">For authorized campaign owners only.</p><div className="mt-3 flex flex-wrap gap-4 text-sm">{!archived&&<Link className="text-gold" href={'/fundraising/campaigns/'+id+'/edit'}>Edit Campaign</Link>}<Link href="/fundraising/performance" className="text-[#26E7D4]">Referral Performance</Link>{!archived&&<form action={removeOrArchiveCampaign}><input type="hidden" name="id" value={id}/><ConfirmSubmitButton message="Are you sure you want to archive or delete this campaign?" className="text-[#E49BA3]">Archive / Delete</ConfirmSubmitButton></form>}</div></section>}
   </div>
   <div className="order-1 lg:order-2 lg:col-start-2 lg:row-start-1">{!archived&&<CampaignDonationFields campaignId={id} currency={campaign.currency_code} requestKey={randomUUID()}/>}</div>
  </div>
  {canEdit&&!archived&&<Card title="Referral links"><p className="mb-5 text-sm text-muted">Create a unique link for each influencer, user, university, NGO, company, partner or channel. Attribution uses the last campaign referral click for 30 days.</p>
   <form action={createCampaignReferralLink} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-2">
    <input type="hidden" name="campaign_id" value={id}/>
    <label className="text-sm">Label<input name="label" required minLength={2} maxLength={180} placeholder="Influencer – Anna Jansen" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
    <label className="text-sm">Source type<select name="source_type" required className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">{referralTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm">Credit to Aluna user or organization (optional)<select name="assigned_actor_id" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">No linked Aluna account</option>{assignable.map(a=><option key={a.id} value={a.id}>{a.name} · {a.kind}</option>)}</select></label>
    <label className="text-sm">External name (optional)<input name="assigned_name" maxLength={180} placeholder="Name shown in campaign analytics" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
    <button className="h-fit rounded-xl bg-gold px-5 py-3 font-semibold text-navy md:col-span-2">Create referral link</button>
   </form>
   <div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-line p-4"><p className="text-xs text-muted">Clicks</p><p className="mt-1 text-2xl text-gold">{totalReferral.clicks}</p></div><div className="rounded-xl border border-line p-4"><p className="text-xs text-muted">Confirmed donors</p><p className="mt-1 text-2xl text-gold">{totalReferral.donors}</p></div><div className="rounded-xl border border-line p-4"><p className="text-xs text-muted">Attributed raised</p><p className="mt-1 text-2xl text-gold">{money(totalReferral.amount,campaign.currency_code)}</p></div></div>
   <div className="mt-6 space-y-4">{referralRows.map(r=>{const assigned=r.assigned_actor_id?assignable.find(a=>a.id===r.assigned_actor_id)?.name:r.assigned_name;const conversion=Number(r.clicks)>0?(Number(r.donor_count)/Number(r.clicks)*100).toFixed(1):'0.0';return <div key={r.link_id} className="rounded-xl border border-line p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-ink">{r.label}</p><p className="mt-1 text-xs text-muted">{r.source_type}{assigned?` · ${assigned}`:''} · {r.is_active?'Active':'Inactive'} · Created {new Date(r.created_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Amsterdam'})}</p></div><form action={setCampaignReferralStatus}><input type="hidden" name="campaign_id" value={id}/><input type="hidden" name="id" value={r.link_id}/><input type="hidden" name="active" value={r.is_active?'false':'true'}/><button className="text-sm text-gold">{r.is_active?'Disable':'Enable'}</button></form></div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6"><span>{r.clicks} clicks</span><span>{r.checkouts} checkouts</span><span>{r.donor_count} donors</span><span>{conversion}% conversion</span><span>{money(Number(r.average_donation),campaign.currency_code)} avg. donation</span><span>{money(Number(r.amount_raised),campaign.currency_code)} raised</span></div>{r.is_active&&<div className="mt-4"><ReferralShare token={r.token} tokenRoute="cr" noun="referral link" title={`${campaign.title} — ${r.label}`}/></div>}</div>})}{!referralRows.length&&<p className="text-muted">No campaign referral links yet.</p>}</div>
  </Card>}

 </div>;
}
