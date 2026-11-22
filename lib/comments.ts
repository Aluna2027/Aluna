import { createClient } from '@/lib/supabase/server';
import { actorDetails } from '@/lib/social';
import type { InlineComment } from '@/components/inline-comments';
/** One embedded query limits each post to two comments, without per-post requests. */
export async function initialComments(ids:string[]):Promise<Map<string,InlineComment[]>>{
 const result=new Map<string,InlineComment[]>();if(!ids.length)return result;
 const client=await createClient();
 const {data,error}=await client.from('posts').select('id,comments(id,actor_id,body,created_at,edited_at)').in('id',ids).order('created_at',{referencedTable:'comments',ascending:true}).order('id',{referencedTable:'comments',ascending:true}).limit(2,{referencedTable:'comments'});
 if(error)throw new Error('Could not load comments');
 const authors=await actorDetails((data??[]).flatMap(p=>p.comments.map(c=>c.actor_id)));
 const annotated=await attachCommentVoteSummary(await attachCommentMentions((data??[]).flatMap(p=>p.comments)));const byId=new Map(annotated.map(c=>[c.id,c]));
 for(const post of data??[])result.set(post.id,post.comments.map(c=>({...c,author:authors.get(c.actor_id)??null,mentions:byId.get(c.id)?.mentions??[],votes:byId.get(c.id)?.votes??{upvotes:0,downvotes:0,myVote:0 as const}})));
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

export type CommentVoteSummary={upvotes:number;downvotes:number;myVote:0|1|-1};
export async function attachCommentVoteSummary<T extends {id:string}>(comments:T[]){
 if(!comments.length)return [] as (T & {votes:CommentVoteSummary})[];
 const client=await createClient();
 const {data,error}=await client.rpc('pr47_comment_vote_summary',{p_comment_ids:comments.map(c=>c.id)});
 if(error)throw new Error('Could not retrieve comment votes');
 const byId=new Map<string,CommentVoteSummary>((data??[]).map((row:{comment_id:string;upvotes:number;downvotes:number;my_vote:number}):[string,CommentVoteSummary]=>
   [row.comment_id,{upvotes:Number(row.upvotes),downvotes:Number(row.downvotes),myVote:Number(row.my_vote) as 0|1|-1}]));
 return comments.map(c=>({...c,votes:byId.get(c.id)??{upvotes:0,downvotes:0,myVote:0 as const}}));
}
