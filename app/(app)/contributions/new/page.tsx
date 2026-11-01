import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {ownedActors} from '@/lib/social';
import {Card} from '@/components/ui';
import {PR43ContributionForm} from '@/components/pr43-contribution-form';
export default async function NewContribution({searchParams}:{searchParams:Promise<{actor?:string;mission?:string;community?:string}>}){
 const initial=await searchParams;const client=await createClient();const actors=await ownedActors();
 const [{data:missions},{data:communities},{data:places},{data:stewards}]=await Promise.all([
  client.from('missions').select('id,title,city_id,community_id,manual_place,created_by_actor_id').is('removed_at',null).order('created_at',{ascending:false}).limit(1000),
  client.from('mesh_communities').select('id,name,city_id').is('removed_at',null).order('created_at',{ascending:false}).limit(1000),
  client.from('places').select('id,name,country_code').not('source_key','is',null).limit(1000),
  client.from('mesh_community_members').select('community_id,actor_id').eq('member_role','steward').in('actor_id',actors.length?actors.map(x=>x.id):['00000000-0000-0000-0000-000000000000']).limit(1000)]);
 const cityNames=Object.fromEntries((places??[]).map(c=>[c.id,c.name+', '+c.country_code]));
 return <div className="space-y-5"><Link href="/contributions" className="text-sm text-gold">← Contributions</Link><Card title="Record Contribution"><p className="mb-5 text-sm text-muted">Select the project first. Each selected contribution type receives its own details, measurable results and evidence.</p><PR43ContributionForm actors={actors} missions={(missions??[]).map(m=>({id:m.id,name:m.title,city_id:m.city_id,community_id:m.community_id,location:m.manual_place??undefined,owner_actor_id:m.created_by_actor_id}))} communities={(communities??[]).map(c=>({id:c.id,name:c.name,city_id:c.city_id,steward_actor_ids:(stewards??[]).filter(s=>s.community_id===c.id).map(s=>s.actor_id)}))} cityNames={cityNames} initial={initial}/></Card></div>;
}
