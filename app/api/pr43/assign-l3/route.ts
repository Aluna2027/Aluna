import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:Request){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const {data:admin,error:adminError}=await client.rpc('is_aluna_admin');
 if(adminError||!admin)return NextResponse.json({error:'Aluna administrator required'},{status:403});
 try{
  const b=await req.json();
  const result=String(b.result??''),profile=String(b.profile??''),actor=String(b.actor??'');
  if(!uuid.test(result)||!uuid.test(profile)||!uuid.test(actor))return NextResponse.json({error:'Invalid assignment'},{status:400});
  const {error}=await client.rpc('pr43_assign_l3',{p_result:result,p_reviewer_profile:profile,p_reviewer_actor:actor});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({assigned:true});
 }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
}
