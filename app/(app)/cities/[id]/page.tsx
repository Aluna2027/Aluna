import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { cityTabs, formatPopulation, getCity, populationCategory } from '@/lib/cities';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { ImpactView } from '@/components/impact-view';
import { iconColors } from '@/lib/icon-colors';

export default async function CityPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}) {
 const {id}=await params;const {tab}=await searchParams;const city=getCity(id);if(!city)notFound();
 const active=cityTabs.find(t=>t.slug===tab)??cityTabs[0];
 const client=await createClient();
 const needsPlace=['wifi-mesh-communities','missions','fundraising'].includes(active.slug);
 const {data:place,error:placeError}=needsPlace?await client.from('places').select('id').eq('source_key',id).maybeSingle():{data:null,error:null};
 const {data:missions,error:missionsError}=place&&['missions','fundraising'].includes(active.slug)
  ?await client.from('missions').select('id,title,location_text').eq('city_id',place.id).is('removed_at',null).order('created_at',{ascending:false}).limit(1000)
  :{data:null,error:null};
 const {data:communities,error:communitiesError}=place&&active.slug==='wifi-mesh-communities'
  ?await client.from('mesh_communities').select('id,name,location_text,people_connected').eq('city_id',place.id).is('removed_at',null).order('name').limit(1000)
  :{data:null,error:null};
 const missionIds=(missions??[]).map(m=>m.id);
 const {data:campaigns,error:campaignsError}=active.slug==='fundraising'&&missionIds.length
  ?await client.from('fundraising_campaigns').select('id,title,mission_id').in('mission_id',missionIds).is('removed_at',null).is('archived_at',null).order('created_at',{ascending:false}).limit(1000)
  :{data:null,error:null};
 const missionNames=new Map((missions??[]).map(m=>[m.id,m.title]));
 const error=placeError||(active.slug==='missions'?missionsError:active.slug==='wifi-mesh-communities'?communitiesError:active.slug==='fundraising'?missionsError||campaignsError:null);
 return <div className="space-y-6"><Link href="/world-map" className="text-sm font-medium text-gold hover:underline">← World map</Link>
  <header className="rounded-3xl bg-navy p-7 text-white sm:p-10"><p className="text-xs tracking-[.2em] text-gold-soft">CITY HUB · {city.region.toUpperCase()}</p><h1 className="mt-3 text-4xl font-semibold">{city.name}</h1><p className="mt-2 text-muted">{city.country} · {formatPopulation(city.population)} people · {populationCategory(city.population).label}</p></header>
  <nav aria-label="City sections" className="flex gap-2 overflow-x-auto pb-2">{cityTabs.map(item=><Link key={item.slug} href={`/cities/${id}?tab=${item.slug}`} aria-current={active.slug===item.slug?'page':undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm ${active.slug===item.slug?'bg-gold text-navy':'glass hover:bg-panel-raised'}`}>{item.title}</Link>)}</nav>
  {active.slug==='overview'?<div className="grid gap-5 md:grid-cols-2"><Card title="About this city"><p>Explore the Aluna network in {city.name}. Community and organization details will be added as the network grows.</p></Card><Card title="City facts"><dl className="space-y-2 text-sm"><div className="flex justify-between gap-4"><dt>Country</dt><dd className="text-ink">{city.country}</dd></div><div className="flex justify-between gap-4"><dt>Region</dt><dd className="text-ink">{city.region}</dd></div><div className="flex justify-between gap-4"><dt>2025 population</dt><dd className="text-ink">{city.population.toLocaleString('en-US')}</dd></div></dl><a className="mt-5 inline-block text-sm text-gold underline" href={city.source} target="_blank" rel="noopener noreferrer">Population source ↗</a></Card></div>:
  active.slug==='missions'?<Card title={`Missions in ${city.name}`}><div className="space-y-3">{error?<p role="alert">Could not load missions for this city.</p>:<>{missions?.map(m=><Link key={m.id} href={`/missions/${m.id}`} className="block rounded-xl border border-line p-3 text-gold hover:border-gold">{m.title} <span className="text-sm text-muted">· {m.location_text}</span></Link>)}{!missions?.length&&<p>No missions have been added for this city yet.</p>}</>}<Link href={`/missions/new?city=${id}`} className="inline-block text-sm text-gold">Create a mission →</Link></div></Card>:
  active.slug==='wifi-mesh-communities'?<Card title={`Wi-Fi Mesh Communities in ${city.name}`}><div className="space-y-3">{error?<p role="alert">Could not load communities for this city.</p>:<>{communities?.map(c=><Link key={c.id} href={`/communities/${c.id}`} className="block rounded-xl border border-line p-3 text-gold hover:border-gold">{c.name} <span className="text-sm text-muted">· {c.location_text}</span></Link>)}{!communities?.length&&<p>No physical mesh communities have been added for this city yet.</p>}</>}<Link href={`/communities/new?city=${id}`} className="inline-block text-sm text-gold">Add a community →</Link></div></Card>:
  active.slug==='fundraising'?<Card title={`Fundraising in ${city.name}`}><div className="space-y-3">{error?<p role="alert">Could not load fundraising campaigns for this city.</p>:<>{campaigns?.map(c=><Link key={c.id} href={`/fundraising/campaigns/${c.id}`} className="block rounded-xl border border-line p-3 text-gold hover:border-gold">{c.title}<span className="text-sm text-muted"> · {missionNames.get(c.mission_id)??'SDG Mission'}</span></Link>)}{!campaigns?.length&&<p>No active fundraising campaigns have been added for this city yet.</p>}</>}<Link href="/fundraising/campaigns/new" className="inline-block text-sm text-gold">Create fundraising →</Link></div></Card>:
  active.slug==='impact'?<section id="impact" className="space-y-4"><div className="flex items-center gap-3 text-lg font-semibold text-ink"><TrendingUp size={24} color={iconColors.impact}/>Impact</div><ImpactView scope={{cityKey:id}} metricIconColor={iconColors.impact} cardsOnly/></section>:null}
 </div>;
}
