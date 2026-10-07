import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors, actorDetails, relativeDate } from '@/lib/social';
import { Card } from '@/components/ui';
import { PostComposer } from '@/components/post-composer';
import { addComment, deletePost, deleteComment } from '@/app/(app)/feed/actions';
import { PostVoteControls } from '@/components/post-vote-controls';
import { ProofList } from '@/components/proof-list';

export default async function PostPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();const actors=await ownedActors();
 const {data:post}=await client.from('posts').select('id,actor_id,body,created_at,repost_of_id,community_id,mission_id,media_path,media_type').eq('id',id).maybeSingle();if(!post)notFound();
 const {data:comments}=await client.from('comments').select('id,actor_id,body,created_at').eq('post_id',id).order('created_at',{ascending:true}).limit(100);
 const {data:reactions}=await client.from('reactions').select('actor_id,vote').eq('post_id',id);
 const upvotes=(reactions??[]).filter(r=>Number(r.vote)!==-1).length;
 const downvotes=(reactions??[]).filter(r=>Number(r.vote)===-1).length;
 const ownedActorIds=new Set(actors.map(a=>a.id));
 const actorVotes:Record<string,1|-1>={};
 for(const reaction of reactions??[]){if(ownedActorIds.has(reaction.actor_id))actorVotes[reaction.actor_id]=Number(reaction.vote)===-1?-1:1;}
 const detail=await actorDetails([post.actor_id,...(comments??[]).map(c=>c.actor_id)]);
 const author=detail.get(post.actor_id);const canEdit=actors.some(a=>a.id===post.actor_id);
 const {data:signed}=post.media_path?await client.storage.from('post-media').createSignedUrl(post.media_path,3600):{data:null};const mediaUrl=signed?.signedUrl;
 return <div className="mx-auto max-w-3xl space-y-6"><Link href="/feed" className="text-sm text-gold">← Global feed</Link>{error&&<p role="alert" className="text-amber-300">Could not complete that action.</p>}
 <div className="relative">{canEdit&&<details className="absolute right-4 top-4 z-10"><summary aria-label="Post actions" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-xl leading-none text-muted hover:bg-panel-raised hover:text-ink">⋯</summary><div className="absolute right-0 mt-2 min-w-36 rounded-xl border border-line bg-panel p-2 shadow-xl"><Link href={`/posts/${id}/edit`} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gold hover:bg-panel-raised">Edit post</Link><form action={deletePost}><input type="hidden" name="id" value={id}/><input type="hidden" name="return_to" value="/feed"/><button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-panel-raised">Delete post</button></form></div></details>}<Card title="Post"><Link href={author?.href||'/feed'} className="text-gold">{author?.name||'Member'} · {author?.kind}</Link><p className="mt-2 text-xs">{relativeDate(post.created_at)}</p><p className="mt-5 whitespace-pre-wrap break-words text-ink">{post.body}</p>{mediaUrl&&post.media_type==='image'&&<img src={mediaUrl} alt="" className="mt-4 max-h-[640px] w-full rounded-2xl object-cover"/>}{mediaUrl&&post.media_type==='video'&&<video src={mediaUrl} controls preload="metadata" className="mt-4 max-h-[640px] w-full rounded-2xl"/>}{post.mission_id&&<Link href={`/missions/${post.mission_id}?tab=posts`} className="mt-3 inline-block text-sm text-gold">Mission →</Link>}{post.community_id&&<Link href={`/communities/${post.community_id}?tab=feed`} className="mt-3 inline-block text-sm text-gold">Wi-Fi Mesh Community →</Link>}{post.repost_of_id&&<Link href={`/posts/${post.repost_of_id}`} className="mt-3 inline-block text-gold">View shared post →</Link>}<PostVoteControls postId={id} commentCount={comments?.length??0} actors={actors} initialUpvotes={upvotes} initialDownvotes={downvotes} initialActorVotes={actorVotes} showComments={false}/></Card></div>
 <Card title={`Comments (${comments?.length??0}${(comments?.length??0)===100?'+':''})`}><div className="space-y-4">{comments?.map(comment=><div key={comment.id} className="border-b border-line pb-3"><Link href={detail.get(comment.actor_id)?.href||'/feed'} className="font-semibold text-gold">{detail.get(comment.actor_id)?.name||'Member'}</Link><span className="ml-2 text-xs">{relativeDate(comment.created_at)}</span><p className="mt-2 whitespace-pre-wrap break-words text-ink">{comment.body}</p>{actors.some(a=>a.id===comment.actor_id)&&<form action={deleteComment} className="mt-2"><input type="hidden" name="id" value={comment.id}/><input type="hidden" name="post_id" value={id}/><button className="text-xs text-red-300">Delete comment</button></form>}</div>)}</div>{actors.length>0&&<form action={addComment} className="mt-6 space-y-3"><input type="hidden" name="post_id" value={id}/><input type="hidden" name="return_to" value={`/posts/${id}`}/><textarea name="body" required maxLength={2000} rows={3} placeholder="Write a comment…" className="w-full rounded-xl border border-line bg-panel-raised p-3 text-ink"/><div className="flex flex-wrap gap-3"><select name="actor_id" aria-label="Comment as" className="rounded-lg border border-line bg-panel-raised p-2">{actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="rounded-lg bg-gold px-4 py-2 font-semibold text-navy">Comment</button></div></form>}</Card>
 <PostComposer actors={actors} returnTo={`/posts/${id}`} repostOf={id}/>
 <ProofList postId={id}/>
 </div>;
}
