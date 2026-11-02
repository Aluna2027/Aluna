import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:Request){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const {data:admin,error:adminError}=await client.rpc('is_aluna_admin');
 if(adminError||!admin)return NextResponse.json({error:'Aluna administrator required'},{status:403});
 try {
  const body=await req.json();
  const result=String(body.result??''),actor=String(body.actor??''),reason=String(body.reason??'').trim();
  if(!uuid.test(result)||!uuid.test(actor)||reason.length<10||reason.length>2000){
   return NextResponse.json({error:'Provide a valid result, reviewer and correction reason (10–2000 characters)'},{status:400});
  }
  const {error}=await client.rpc('pr43_revoke_result',{p_result:result,p_actor:actor,p_reason:reason});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({revoked:true});
 }catch{
  return NextResponse.json({error:'Invalid request'},{status:400});
 }
}
