import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
export default async function Search({searchParams}:{searchParams:Promise<{q?:string}>}) {
 const {q}=await searchParams;const term=(q??'').trim().slice(0,80);const client=await createClient();
 // Escape LIKE metacharacters: searching is literal, even for user-supplied % or _.
 const pattern=`%${term.replace(/[\\%_]/g,'\\$&')}%`;
 const [people,organizations]=term?await Promise.all([
 client.from('profiles').select('id,display_name,bio').ilike('display_name',pattern).limit(20),
 client.from('organizations').select('id,name,organization_type,description').ilike('name',pattern).limit(20),
 ]):[{data:[]},{data:[]}];
 return <div className="space-y-6"><div><p className="deck-label">EXPLORE ALUNA</p><h1 className="mt-2 text-4xl">Search</h1></div><form className="flex gap-3"><input name="q" type="search" defaultValue={term} maxLength={80} placeholder="People or organizations" className="min-w-0 flex-1 rounded-xl border border-line bg-panel p-3"/><button className="rounded-xl bg-gold px-5 font-semibold text-navy">Search</button></form>
 {term&&<div className="grid gap-5 md:grid-cols-2"><section className="glass rounded-2xl p-5"><h2 className="text-lg">People</h2><div className="mt-4 space-y-3">{people.data?.map(person=><Link href={`/people/${person.id}`} key={person.id} className="block border-b border-line pb-2 text-gold">{person.display_name}</Link>)}{!people.data?.length&&<p className="text-sm text-muted">No matches.</p>}</div></section><section className="glass rounded-2xl p-5"><h2 className="text-lg">Organizations</h2><div className="mt-4 space-y-3">{organizations.data?.map(org=><Link href={`/organizations/${org.id}`} key={org.id} className="block border-b border-line pb-2 text-gold">{org.name} <span className="text-xs text-muted">· {org.organization_type}</span></Link>)}{!organizations.data?.length&&<p className="text-sm text-muted">No matches.</p>}</div></section></div>}
 </div>;
}
