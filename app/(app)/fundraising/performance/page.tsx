import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { money } from '@/lib/missions';

type Row={actor_id:string;actor_name:string;actor_kind:string;currency_code:string;amount_raised:number;donor_count:number;donations_attributed:number;clicks:number;campaigns:number};
type Global={currency_code:string;amount_raised:number;donor_count:number;donations_attributed:number;clicks:number;campaigns:number;users:number;organizations:number};

function Table({title,rows}:{title:string;rows:Row[]}){return <Card title={title}><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr><th className="p-3">Rank</th><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Raised</th><th className="p-3">Donors</th><th className="p-3">Clicks</th><th className="p-3">Conversion</th><th className="p-3">Average donation</th><th className="p-3">Campaigns</th></tr></thead><tbody>{rows.map((row,index)=>{const conversion=Number(row.clicks)>0?Number(row.donor_count)/Number(row.clicks)*100:0;const average=Number(row.donations_attributed)>0?Number(row.amount_raised)/Number(row.donations_attributed):0;return <tr key={row.actor_id+'-'+row.currency_code} className="border-t border-line"><td className="p-3">{index+1}</td><td className="p-3 text-ink">{row.actor_name}</td><td className="p-3">{row.actor_kind}</td><td className="p-3 text-gold">{money(Number(row.amount_raised),row.currency_code)}</td><td className="p-3">{row.donor_count}</td><td className="p-3">{row.clicks}</td><td className="p-3">{conversion.toFixed(1)}%</td><td className="p-3">{money(average,row.currency_code)}</td><td className="p-3">{row.campaigns}</td></tr>})}{!rows.length&&<tr><td colSpan={9} className="p-3 text-muted">No attributed fundraising performance yet.</td></tr>}</tbody></table></div></Card>}

export default async function Performance({searchParams}:{searchParams:Promise<{org?:string;currency?:string}>}){
 const {org,currency}=await searchParams;const client=await createClient();
 const orgType=['university','ngo','company'].includes(org??'')?org:null;
 const [{data:globalRows},{data:allRows},{data:userRows},{data:organizationRows}]=await Promise.all([
  client.rpc('fundraising_global_performance'),
  client.rpc('fundraising_actor_leaderboard',{p_scope:'all',p_org_type:null,p_limit:100}),
  client.rpc('fundraising_actor_leaderboard',{p_scope:'user',p_org_type:null,p_limit:100}),
  client.rpc('fundraising_actor_leaderboard',{p_scope:'organization',p_org_type:orgType,p_limit:100}),
 ]);
 const global=(globalRows??[]) as Global[];const currencies=global.map(row=>row.currency_code);const selected=currency&&currencies.includes(currency)?currency:currencies[0]??null;
 const all=((allRows??[]) as Row[]).filter(row=>!selected||row.currency_code===selected);
 const users=((userRows??[]) as Row[]).filter(row=>!selected||row.currency_code===selected);
 const organizations=((organizationRows??[]) as Row[]).filter(row=>!selected||row.currency_code===selected);
 const total=global.find(row=>row.currency_code===selected);
 return <div className="space-y-6"><Link href="/fundraising" className="text-sm text-gold">← Fundraising</Link><header className="glass rounded-3xl p-7 sm:p-9"><p className="deck-label">GLOBAL FUNDRAISING PERFORMANCE</p><h1 className="mt-3 text-4xl">Fundraising Leaderboards</h1><p className="mt-3 text-muted">Confirmed donation performance attributed through unique campaign referral links.</p></header>
 {currencies.length>1&&<nav className="flex flex-wrap gap-2">{currencies.map(code=><Link key={code} href={`/fundraising/performance?currency=${code}${orgType?`&org=${orgType}`:''}`} className={`rounded-full px-4 py-2 text-sm ${selected===code?'bg-gold text-navy':'glass'}`}>{code}</Link>)}</nav>}
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Card title="Attributed raised"><p className="text-3xl text-gold">{selected?money(Number(total?.amount_raised??0),selected):'—'}</p></Card><Card title="Confirmed donors"><p className="text-3xl text-gold">{total?.donor_count??0}</p></Card><Card title="Referral clicks"><p className="text-3xl text-gold">{total?.clicks??0}</p></Card><Card title="Conversion"><p className="text-3xl text-gold">{Number(total?.clicks??0)>0?(Number(total?.donor_count??0)/Number(total?.clicks??0)*100).toFixed(1):'0.0'}%</p></Card><Card title="Average donation"><p className="text-3xl text-gold">{selected?money(Number(total?.donations_attributed??0)>0?Number(total?.amount_raised??0)/Number(total?.donations_attributed??0):0,selected):'—'}</p></Card><Card title="Campaigns"><p className="text-3xl text-gold">{total?.campaigns??0}</p></Card></div>
 <Table title="Global leaderboard — users + organizations" rows={all}/>
 <Table title="User leaderboard" rows={users}/>
 <div className="space-y-3"><nav className="flex flex-wrap gap-2">{[['All organizations',''],['Universities','university'],['NGOs','ngo'],['Companies','company']].map(([label,value])=><Link key={label} href={`/fundraising/performance?${selected?`currency=${selected}&`:''}${value?`org=${value}`:''}`} className={`rounded-full px-4 py-2 text-sm ${(orgType??'')===value?'bg-gold text-navy':'glass'}`}>{label}</Link>)}</nav><Table title="Organization leaderboard" rows={organizations}/></div>
 </div>;
}
