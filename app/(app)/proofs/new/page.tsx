import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Card} from '@/components/ui';
import {createClient} from '@/lib/supabase/server';
import {ownedActors} from '@/lib/social';
import {PR43ProofReview} from '@/components/pr43-proof-review';
export default async function NewProof({searchParams}:{searchParams:Promise<{mission?:string;community?:string;contribution?:string;post?:string}>}){
 const initial=await searchParams;
 if(initial.post)redirect(`/proofs/new/legacy?post=${encodeURIComponent(initial.post)}`);
 const client=await createClient();
 if(initial.contribution&&/^[0-9a-f-]{36}$/i.test(initial.contribution)){
  const {data:existing}=await client.from('contributions').select('submission_id').eq('id',initial.contribution).maybeSingle();
  if(existing&&!existing.submission_id){
   const params=new URLSearchParams({contribution:initial.contribution});
   if(initial.mission)params.set('mission',initial.mission);
   redirect(`/proofs/new/legacy?${params.toString()}`);
  }
 }
 const [{data:isAlunaAdmin},{data:isSuperAdmin}]=await Promise.all([client.rpc('is_aluna_admin'),client.rpc('is_aluna_super_admin')]);
 const actors=await ownedActors();
 const [{data:missions},{data:communities},{data:contributions}]=await Promise.all([
 client.from('missions').select('id,title').is('removed_at',null).limit(1000),
 client.from('mesh_communities').select('id,name').is('removed_at',null).limit(1000),
 client.from('contributions').select('id,title,description,details,contribution_type,contributed_on,mission_id,community_id,actor_id,pr43_contribution_results(id,metric_key,quantity,unit,verification_level,verified_quantity),pr43_contribution_files(id,filename,storage_path)').not('submission_id','is',null).order('created_at',{ascending:false}).limit(250)]);
 const rows=(contributions??[]) as unknown as Parameters<typeof PR43ProofReview>[0]['items'];
 const reviewItems=rows.map(row=>({...row,pr43_contribution_files:row.pr43_contribution_files.map(file=>({...file,url:`/api/pr43/evidence?fileId=${encodeURIComponent(file.id)}`}))}));
 return <div className="space-y-5"><Link href="/proofs" className="text-sm text-gold">← Proofs</Link><Card title="Proofs & Verification">{isAlunaAdmin&&<Link href="/proofs/l3-admin" className="mb-4 block text-sm text-gold">Manage independent L3 reviewer assignments →</Link>}<Link href="/proofs/new/legacy" className="mb-4 inline-block text-sm text-gold">Submit proof for an earlier Contribution or public post →</Link><p className="mb-5 text-sm text-muted">Select your actor and a project. Review each contribution result separately, with an optional impact description. Review time is captured automatically.</p><PR43ProofReview actors={actors} missions={(missions??[]).map(m=>({id:m.id,name:m.title}))} communities={(communities??[]).map(c=>({id:c.id,name:c.name}))} items={reviewItems} initial={initial} isSuperAdmin={isSuperAdmin===true}/></Card></div>;
}
