import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {ownedActors} from '@/lib/social';
const allowed=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
export async function POST(req:Request){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const form=await req.formData(),submission=String(form.get('submission')??''),type=String(form.get('type')??''),contributionId=String(form.get('contribution')??''),file=form.get('file');
 if((!(/^[0-9a-f-]{36}$/i.test(submission)&&type)&&!/^[0-9a-f-]{36}$/i.test(contributionId))||!(file instanceof File)||!allowed.has(file.type)||file.size<1||file.size>20971520)return NextResponse.json({error:'Invalid evidence file'},{status:400});
 let lookup=client.from('contributions').select('id,actor_id,mission_id,community_id');
 if(contributionId)lookup=lookup.eq('id',contributionId);else lookup=lookup.eq('submission_id',submission).eq('contribution_type',type);
 const {data:contribution}=await lookup.maybeSingle();
 if(!contribution)return NextResponse.json({error:'No matching contribution'},{status:404});
 const {data:actor}=await client.from('actors').select('profile_id,organization_id').eq('id',contribution.actor_id).maybeSingle();
 const {data:membership}=actor?.organization_id?await client.from('organization_members').select('profile_id').eq('profile_id',user.id).eq('organization_id',actor.organization_id).eq('member_role','admin').maybeSingle():{data:null};
 let allowedReviewer=actor?.profile_id===user.id||Boolean(membership);
 if(!allowedReviewer){
  const owned=await ownedActors();
  const orgs=owned.filter(a=>a.kind!=='user');
  const ids=orgs.map(a=>a.id);
  if(ids.length){
   const [{data:participations},{data:members}]=await Promise.all([
    contribution.mission_id?client.from('mission_participations').select('actor_id').eq('mission_id',contribution.mission_id).in('actor_id',ids).limit(1):Promise.resolve({data:[]}),
    contribution.community_id?client.from('mesh_community_members').select('actor_id').eq('community_id',contribution.community_id).in('actor_id',ids).limit(1):Promise.resolve({data:[]})
   ]);
   allowedReviewer=Boolean(participations?.length||members?.length);
  }
  if(!allowedReviewer){
   const {data:assignments}=await client.from('pr43_l3_assignments').select('result_id').eq('reviewer_profile_id',user.id).is('revoked_at',null);
   const ids=(assignments??[]).map(a=>a.result_id);
   if(ids.length){
    const {data:results}=await client.from('pr43_contribution_results').select('id').in('id',ids).eq('contribution_id',contribution.id).eq('verification_level',2).limit(1);
    allowedReviewer=Boolean(results?.length);
   }
  }
  if(!allowedReviewer){const {data:admin}=await client.rpc('is_aluna_admin');allowedReviewer=Boolean(admin);}
 }
 if(!allowedReviewer)return NextResponse.json({error:'Not permitted'},{status:403});
 const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'evidence';
 const path=user.id+'/'+contribution.id+'/'+crypto.randomUUID()+'-'+clean;
 const upload=await client.storage.from('contribution-evidence').upload(path,file,{contentType:file.type,upsert:false});
 if(upload.error)return NextResponse.json({error:'Evidence upload failed'},{status:400});
 const {error}=await client.from('pr43_contribution_files').insert({contribution_id:contribution.id,storage_path:path,filename:file.name.slice(0,200),content_type:file.type});
 if(error){await client.storage.from('contribution-evidence').remove([path]);return NextResponse.json({error:'Evidence registration failed'},{status:400});}
 return NextResponse.json({ok:true});
}
