import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
export async function POST(req:Request){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 try{
  const b=await req.json();if(!/^[0-9a-f-]{36}$/i.test(String(b.result))||!/^[0-9a-f-]{36}$/i.test(String(b.actor))||typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<0||b.quantity>1e9||String(b.impact_result??'').length>3000) return NextResponse.json({error:'Invalid review'},{status:400});
  const {data,error}=await client.rpc('pr43_review_result',{p_result:b.result,p_actor:b.actor,p_value:b.quantity,p_impact_result:String(b.impact_result??'')});
  if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({level:data});
 }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
}
