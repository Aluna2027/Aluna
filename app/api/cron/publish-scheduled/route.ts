import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

// Restricted cron entrypoint. Never accepts user-provided post data.
// This route is inert until CRON_SECRET and an external minute-level
// schedule are configured. An incorrect token cannot publish anything.
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get('authorization')!==`Bearer ${secret}`)
  return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Scheduler is not configured'},{status:503});
 try{
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.rpc('publish_due_scheduled_posts',{p_limit:25});
  if(error)return NextResponse.json({error:'Publication batch failed'},{status:500});
  return NextResponse.json({ok:true,published:data??0});
 }catch{
  return NextResponse.json({error:'Scheduler unavailable'},{status:500});
 }
}
