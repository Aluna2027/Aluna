import { createClient } from '@/lib/supabase/server';
import { actorDetails } from '@/lib/social';
import type { InlineComment } from '@/components/inline-comments';
/** One embedded query limits each post to two comments, without per-post requests. */
export async function initialComments(ids:string[]):Promise<Map<string,InlineComment[]>>{
 const result=new Map<string,InlineComment[]>();if(!ids.length)return result;
 const client=await createClient();
 const {data,error}=await client.from('posts').select('id,comments(id,actor_id,body,created_at)').in('id',ids).order('created_at',{referencedTable:'comments',ascending:true}).order('id',{referencedTable:'comments',ascending:true}).limit(2,{referencedTable:'comments'});
 if(error)throw new Error('Could not load comments');
 const authors=await actorDetails((data??[]).flatMap(p=>p.comments.map(c=>c.actor_id)));
 for(const post of data??[])result.set(post.id,post.comments.map(c=>({...c,author:authors.get(c.actor_id)??null})));
 return result;
}
