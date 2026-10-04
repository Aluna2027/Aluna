import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Organizations({searchParams}:{searchParams:Promise<{type?:string}>}) {
 const {type}=await searchParams;const client=await createClient();
 const filter=['university','ngo','company'].includes(type??'')?type:undefined;
 let query=client.from('organizations').select('id,name,organization_type,description,location_text').order('name').limit(100);
 if(filter)query=query.eq('organization_type',filter);
 const {data:organizations}=await query;
 return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="deck-label">ALUNA ACTORS</p><h1 className="mt-2 text-4xl">Organizations</h1></div><Link href={filter?`/organizations/new?type=${filter}`:'/organizations/new'} className="h-fit rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">Create organization</Link></div>
 <nav aria-label="Organization types" className="flex gap-2 overflow-x-auto">{[['All',''],['Universities','university'],['NGOs','ngo'],['Companies','company']].map(([label,value])=><Link key={label} href={value?`/organizations?type=${value}`:'/organizations'} aria-current={(type??'')===value?'page':undefined} className={`rounded-full px-4 py-2 text-sm ${(type??'')===value?'bg-gold text-navy':'glass'}`}>{label}</Link>)}</nav>
 <div className="grid gap-4 md:grid-cols-2">{organizations?.map(org=><Link key={org.id} href={`/organizations/${org.id}`} className="glass rounded-2xl p-6 hover:border-gold"><p className="deck-label">{org.organization_type}</p><h2 className="mt-2 text-xl">{org.name}</h2>{org.location_text&&<p className="mt-2 text-sm text-muted">{org.location_text}</p>}<p className="mt-3 line-clamp-2 text-sm text-muted">{org.description||'Explore this organization’s profile.'}</p></Link>)}</div>
 {!organizations?.length&&<p className="text-muted">No organizations in this category yet.</p>}
 </div>;
}
