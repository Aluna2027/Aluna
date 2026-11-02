import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {contributionTypes} from '@/lib/contributions';
export async function POST(request:Request){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 try{
  const body=await request.json();if(JSON.stringify(body).length>150000)return NextResponse.json({error:'Contribution too large'},{status:413});const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const actor=String(body.actor??''),mission=body.mission?String(body.mission):null,community=body.community?String(body.community):null;
  if(!uuid.test(actor)||mission&&!uuid.test(mission)||community&&!uuid.test(community)||!mission&&!community)return NextResponse.json({error:'Choose a valid project and actor'},{status:400});
  const items=body.items;
  if(!Array.isArray(items)||items.length<1||items.length>11||new Set(items.map(x=>x.type)).size!==items.length)return NextResponse.json({error:'Choose unique contribution types'},{status:400});
  for(const entry of items){
   if(!contributionTypes.some(t=>t.value===entry.type)||typeof entry.title!=='string'||entry.title.trim().length<3||entry.title.length>160||typeof entry.description!=='string'||entry.description.trim().length<10||entry.description.length>3000||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Array.isArray(entry.metrics)||!entry.metrics.length) return NextResponse.json({error:'Please complete each selected type'},{status:400});
   const validDate=new Date(entry.date+'T00:00:00Z');if(Number.isNaN(validDate.valueOf())||validDate.toISOString().slice(0,10)!==entry.date)return NextResponse.json({error:'Invalid date'},{status:400});
   for(const metric of entry.metrics){
    if(typeof metric.key!=='string'||typeof metric.quantity!=='number'||!Number.isFinite(metric.quantity)||metric.quantity<0||metric.quantity>1e9)return NextResponse.json({error:'Invalid measurement'},{status:400});
   }
   if(entry.type==='complete_sdg_mission'&&!mission||entry.type==='complete_wifi_community'&&!community)return NextResponse.json({error:'Select the project to complete'},{status:400});
  }
  const {data,error}=await client.rpc('pr43_record_contributions',{p_actor:actor,p_mission:mission,p_community:community,p_items:items});
  if(error)return NextResponse.json({error:error.message.includes('Could not find the function')?'PR43 database migration is not installed in this environment':error.message},{status:400});
  return NextResponse.json({submission:data});
 }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
}
