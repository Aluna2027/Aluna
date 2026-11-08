import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request:Request){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const {data:authorized,error:authError}=await client.rpc('pr45_can_approve_l4');
 if(authError||authorized!==true)return NextResponse.json({error:'Aluna L4 verifier authorization required'},{status:403});
 try{
  const body=await request.json();
  const result=String(body.result??''),actor=String(body.actor??''),reason=String(body.reason??'').trim();
  const quantity=body.quantity;
  if(!uuid.test(result)||!uuid.test(actor)||typeof quantity!=='number'||!Number.isFinite(quantity)
     ||quantity<0||quantity>1e9||reason.length<20||reason.length>1600)
   return NextResponse.json({error:'Select a valid result and actor, and supply a reason (20-1600 characters)'},{status:400});
  const {data,error}=await client.rpc('pr45_super_admin_approve_result',{
   p_result:result,p_actor:actor,p_value:quantity,p_reason:reason
  });
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({level:data,approval:'aluna_internal',independentlyVerified:false});
 }catch{
  return NextResponse.json({error:'Invalid request'},{status:400});
 }
}
