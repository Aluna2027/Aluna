import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
const allowed=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
export async function POST(req:Request){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const form=await req.formData(),submission=String(form.get('submission')??''),type=String(form.get('type')??''),file=form.get('file');
 if(!/^[0-9a-f-]{36}$/i.test(submission)||!type||!(file instanceof File)||!allowed.has(file.type)||file.size<1||file.size>20971520)return NextResponse.json({error:'Invalid evidence file'},{status:400});
 const {data:contribution}=await client.from('contributions').select('id,actor_id').eq('submission_id',submission).eq('contribution_type',type).maybeSingle();
 if(!contribution)return NextResponse.json({error:'No matching contribution'},{status:404});
 const {data:actor}=await client.from('actors').select('profile_id,organization_id').eq('id',contribution.actor_id).maybeSingle();
 const {data:membership}=actor?.organization_id?await client.from('organization_members').select('profile_id').eq('profile_id',user.id).eq('organization_id',actor.organization_id).eq('member_role','admin').maybeSingle():{data:null};
 if(actor?.profile_id!==user.id&&!membership)return NextResponse.json({error:'Not permitted'},{status:403});
 const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'evidence';
 const path=user.id+'/'+contribution.id+'/'+crypto.randomUUID()+'-'+clean;
 const upload=await client.storage.from('contribution-evidence').upload(path,file,{contentType:file.type,upsert:false});
 if(upload.error)return NextResponse.json({error:'Evidence upload failed'},{status:400});
 const {error}=await client.from('pr43_contribution_files').insert({contribution_id:contribution.id,storage_path:path,filename:file.name.slice(0,200),content_type:file.type});
 if(error){await client.storage.from('contribution-evidence').remove([path]);return NextResponse.json({error:'Evidence registration failed'},{status:400});}
 return NextResponse.json({ok:true});
}
