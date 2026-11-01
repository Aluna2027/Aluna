import Link from 'next/link';
import {Card} from '@/components/ui';
import {createClient} from '@/lib/supabase/server';
import {ownedActors} from '@/lib/social';
import {PR43ProofReview} from '@/components/pr43-proof-review';
export default async function NewProof({searchParams}:{searchParams:Promise<{mission?:string;community?:string;contribution?:string}>}){
 const initial=await searchParams;const client=await createClient();const actors=await ownedActors();
 const [{data:missions},{data:communities},{data:contributions}]=await Promise.all([
 client.from('missions').select('id,title').is('removed_at',null).limit(1000),
 client.from('mesh_communities').select('id,name').is('removed_at',null).limit(1000),
 client.from('contributions').select('id,title,description,contribution_type,contributed_on,mission_id,community_id,actor_id,pr43_contribution_results(id,metric_key,quantity,unit,verification_level,verified_quantity),pr43_contribution_files(id,filename,storage_path)').order('created_at',{ascending:false}).limit(250)]);
 const rows=(contributions??[]) as unknown as Parameters<typeof PR43ProofReview>[0]['items'];
 const paths=rows.flatMap(row=>row.pr43_contribution_files.map(file=>file.storage_path));
 const {data:signed}=paths.length?await client.storage.from('contribution-evidence').createSignedUrls(paths,900):{data:[]};
 const signedMap=new Map((signed??[]).map(file=>[file.path,file.signedUrl]));
 const reviewItems=rows.map(row=>({...row,pr43_contribution_files:row.pr43_contribution_files.map(file=>({...file,url:signedMap.get(file.storage_path)??null}))}));
 return <div className="space-y-5"><Link href="/proofs" className="text-sm text-gold">← Proofs</Link><Card title="Proofs & Verification"><p className="mb-5 text-sm text-muted">Select your actor and a project. Review each contribution result separately, with an optional impact description. Review time is captured automatically.</p><PR43ProofReview actors={actors} missions={(missions??[]).map(m=>({id:m.id,name:m.title}))} communities={(communities??[]).map(c=>({id:c.id,name:c.name}))} items={reviewItems} initial={initial}/></Card></div>;
}
