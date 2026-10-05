import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Organizations({searchParams}:{searchParams:Promise<{type?:string;q?:string}>}) {
 const {type,q:rawQuery}=await searchParams;const client=await createClient();
 const filter=['university','ngo','company'].includes(type??'')?type:undefined;
 const queryText=(rawQuery??'').trim().slice(0,120);
 let query=client.from('organizations').select('id,name,organization_type,description,location_text').order('name').limit(100);
 if(filter)query=query.eq('organization_type',filter);
 if(queryText){
  const normalized=queryText.toLocaleLowerCase('en');
  const typeSearch=
   ['university','universities'].includes(normalized)?'university':
   ['ngo','ngos'].includes(normalized)?'ngo':
   ['company','companies','business','businesses'].includes(normalized)?'company':
   null;
  if(typeSearch)query=query.eq('organization_type',typeSearch);
  else{
   const safe=queryText.replace(/[%_,()]/g,' ').replace(/\s+/g,' ').trim();
   if(safe)query=query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,location_text.ilike.%${safe}%`);
  }
 }
 const {data:organizations}=await query;
 return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="deck-label">ALUNA ACTORS</p><h1 className="mt-2 text-4xl">Organizations</h1></div><Link href={filter?`/organizations/new?type=${filter}`:'/organizations/new'} className="h-fit rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Create organization</Link></div>
 <form method="get" className="glass rounded-2xl p-4">{filter&&<input type="hidden" name="type" value={filter}/>}<label className="block text-sm">Search Organizations<div className="mt-2 flex flex-col gap-2 sm:flex-row"><input name="q" defaultValue={queryText} placeholder="Search Universities, Companies and NGOs" className="w-full rounded-xl border border-line bg-panel-raised p-3"/><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Search</button>{queryText&&<Link href={filter?`/organizations?type=${filter}`:'/organizations'} className="rounded-xl border border-line px-5 py-3 text-center text-gold">Clear</Link>}</div></label></form>
 <nav aria-label="Organization types" className="flex gap-2 overflow-x-auto">{[['All',''],['Universities','university'],['NGOs','ngo'],['Companies','company']].map(([label,value])=><Link key={label} href={value?`/organizations?type=${value}${queryText?`&q=${encodeURIComponent(queryText)}`:''}`:queryText?`/organizations?q=${encodeURIComponent(queryText)}`:'/organizations'} aria-current={(type??'')===value?'page':undefined} className={`rounded-full px-4 py-2 text-sm ${(type??'')===value?'bg-gold text-navy':'glass'}`}>{label}</Link>)}</nav>
 <div className="grid gap-4 md:grid-cols-2">{organizations?.map(org=><Link key={org.id} href={`/organizations/${org.id}`} className="glass rounded-2xl p-6 hover:border-gold"><p className="deck-label">{org.organization_type}</p><h2 className="mt-2 text-xl">{org.name}</h2>{org.location_text&&<p className="mt-2 text-sm text-muted">{org.location_text}</p>}<p className="mt-3 line-clamp-2 text-sm text-muted">{org.description||'Explore this organization’s profile.'}</p></Link>)}</div>
 {!organizations?.length&&<p className="text-muted">{queryText?'No organizations match your search.':'No organizations in this category yet.'}</p>}
 </div>;
}
