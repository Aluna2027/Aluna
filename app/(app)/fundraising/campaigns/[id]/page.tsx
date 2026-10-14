import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, ownedActors, relativeDate } from '@/lib/social';
import { Progress, campaignTotal, type Total, type Campaign } from '@/lib/fundraising';
import { money } from '@/lib/missions';
import { getCity } from '@/lib/cities';
import { sdgLabel, sdgColors } from '@/lib/sdgs';
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
  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-2">
   <div className="min-w-0"><p className="deck-label !text-[.55rem] sm:!text-[.7rem]">PEOPLE · PLACES · POSSIBILITY</p><p className="mt-1 text-xs text-muted sm:text-sm">Welcome, <Link href="/profile" className="font-semibold text-gold hover:underline">{visitorName}</Link></p></div>
   <div className="min-w-0 text-center"><p className="text-[.55rem] font-semibold uppercase tracking-wider text-gold sm:text-xs">SDG FUNDRAISING</p><h1 className="break-words text-sm font-bold normal-case leading-tight text-ink sm:text-xl">{campaign.title}</h1></div>
   <Link href="/fundraising" className="min-w-0 text-right text-[.65rem] font-semibold text-gold hover:underline sm:text-sm">← Fundraising</Link>
  </div>
  {referral_status&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Referral link {referral_status}.</p>}
  {remove_error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not delete this campaign. Please try again.</p>}
  {archived&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">This campaign is archived. Its financial and referral history is preserved.</p>}
  {referral_error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Could not update the referral link. Check the details and try again.</p>}
  <header className="glass rounded-2xl p-6 sm:p-8">
   <p className="text-sm font-semibold text-gold">{missionLocation||'SDG Mission fundraising'}</p>
   <div className="mt-3 flex flex-wrap gap-2">{(campaignSdgs??[]).map(row=><span key={row.sdg_number} className="rounded-lg border px-2 py-1 text-xs font-semibold" style={{borderColor:sdgColors[row.sdg_number],color:sdgColors[row.sdg_number]}}>{sdgLabel(row.sdg_number)}</span>)}</div>
   <Link href={`/missions/${campaign.mission_id}`} className="mt-3 block text-sm text-gold hover:underline">{campaign.missions?.title||'SDG Mission'} →</Link>
   <h2 className="mt-3 text-2xl text-ink sm:text-3xl">{campaign.title}</h2>
   <p className="mt-3 text-sm text-muted">Created by {actors.get(campaign.actor_id)?.name||'Member'} · {relativeDate(campaign.created_at)}</p>
   <div className="mt-6 max-w-xl"><Progress amount={summary.amount} count={summary.count} goal={Number(campaign.goal_amount)} currency={campaign.currency_code}/></div>
   <div className="mt-6 flex flex-wrap items-center gap-4">
    {canEdit&&<Link href="/fundraising/performance" className="text-sm text-gold">Global fundraising performance →</Link>}
    {canEdit&&!archived&&<Link href={`/fundraising/campaigns/${id}/edit`} className="text-sm text-gold">Edit campaign →</Link>}
    {canEdit&&!archived&&<form action={removeOrArchiveCampaign}><input type="hidden" name="id" value={id}/><ConfirmSubmitButton message="Are you sure you want to delete this campaign?" className="text-sm text-red-300">Delete campaign</ConfirmSubmitButton></form>}
   </div>
  </header>
  {!archived&&<ReferralShare path={`/c/${id}`} title={campaign.title}/>} 
  {!archived&&<DonationForm campaignId={id} currency={campaign.currency_code}/>} 
  <Card title="Campaign story"><p className="whitespace-pre-wrap">{campaign.story}</p></Card>
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
  <Card title="Fundraisers"><div className="space-y-3">{fundraisers?.map(f=>{const total=byFundraiser.get(f.id);return <Link key={f.id} href={`/fundraising/${f.slug}`} className="block rounded-xl border border-line p-4 hover:border-gold"><p className="text-gold">{f.title} · {f.kind==='team'?'Team':'Personal'}</p><p className="my-2 text-xs">By {actors.get(f.actor_id)?.name}</p><Progress amount={Number(total?.amount_raised??0)} count={Number(total?.donor_count??0)} goal={Number(f.goal_amount)} currency={campaign.currency_code}/></Link>})}{!fundraisers?.length&&<p>No fundraisers yet.</p>}</div></Card>
 </div>;
}
