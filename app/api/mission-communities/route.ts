import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cities } from '@/lib/cities';
export async function GET(req:NextRequest){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const citySource=req.nextUrl.searchParams.get('city')??'';
 const selectedId=req.nextUrl.searchParams.get('selected')??'';
 const q=(req.nextUrl.searchParams.get('q')??'').trim().slice(0,80).replace(/[%_,()]/g,' ');
 if(!cities.some(c=>c.id===citySource))return NextResponse.json({items:[]});
 const {data:city}=await client.from('places').select('id').eq('source_key',citySource).maybeSingle();
 if(!city)return NextResponse.json({items:[]});
 let query=client.from('mesh_communities').select('id,name').eq('city_id',city.id).is('removed_at',null).order('name').limit(25);
 if(q)query=query.ilike('name',`%${q}%`);
 const {data,error}=await query;
 if(error)return NextResponse.json({error:'Search failed'},{status:500});
 let items=data??[];
 if(/^[0-9a-f-]{36}$/i.test(selectedId)&&!items.some(c=>c.id===selectedId)){
  const {data:selected}=await client.from('mesh_communities').select('id,name').eq('city_id',city.id).eq('id',selectedId).is('removed_at',null).maybeSingle();
  if(selected)items=[selected,...items];
 }
 return NextResponse.json({items});
}
