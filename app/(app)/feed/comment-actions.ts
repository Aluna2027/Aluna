'use server';
import { createClient } from '@/lib/supabase/server';
import { actorDetails } from '@/lib/social';

export async function commentPage(postId:string,after?:{created_at:string;id:string}){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in to read comments');
 if(after&&(!/^[0-9a-f-]{36}$/i.test(after.id)||!/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(after.created_at)))throw new Error('Invalid cursor');
 let query=client.from('comments').select('id,actor_id,body,created_at').eq('post_id',postId).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(20);
 if(after)query=query.or(`created_at.gt.${after.created_at},and(created_at.eq.${after.created_at},id.gt.${after.id})`);
 const {data,error}=await query;
 if(error)throw new Error('Could not load comments');
 const authors=await actorDetails((data??[]).map(c=>c.actor_id));
 return (data??[]).map(c=>({...c,author:authors.get(c.actor_id)??null}));
}
export async function createCommentInline(postId:string,actorId:string,body:string){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return {ok:false as const};
 const text=body.trim();if(!text||text.length>2000)return {ok:false as const};
 const {data,error}=await client.from('comments').insert({post_id:postId,actor_id:actorId,body:text}).select('id,actor_id,body,created_at').single();
 if(error||!data)return {ok:false as const};
 const authors=await actorDetails([data.actor_id]);return {ok:true as const,comment:{...data,author:authors.get(data.actor_id)??null}};
}
export async function deleteCommentInline(id:string){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return false;const {data,error}=await client.from('comments').delete().eq('id',id).select('id');return !error&&!!data?.length;}
