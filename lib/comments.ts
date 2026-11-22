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
 const annotated=await attachCommentMentions((data??[]).flatMap(p=>p.comments));const byId=new Map(annotated.map(c=>[c.id,c.mentions]));
 for(const post of data??[])result.set(post.id,post.comments.map(c=>({...c,author:authors.get(c.actor_id)??null,mentions:byId.get(c.id)??[]})));
 return result;
}

export async function attachCommentMentions<T extends {id:string}>(comments:T[]){
 const client=await createClient();if(!comments.length)return comments.map(c=>({...c,mentions:[]}));
 const {data,error}=await client.from('comment_mentions').select('comment_id,actor_id,start_offset,label').in('comment_id',comments.map(c=>c.id));
 // Pending-migration preview: preserve ordinary comments, never infer references from text.
 if(error)return comments.map(c=>({...c,mentions:[]}));
 const actors=await actorDetails((data??[]).map(r=>r.actor_id));
 return comments.map(c=>({...c,mentions:(data??[]).filter(r=>r.comment_id===c.id).flatMap(r=>{const a=actors.get(r.actor_id);return a?[{actorId:r.actor_id,start:r.start_offset,label:r.label,href:a.href}]:[];})}));
}
