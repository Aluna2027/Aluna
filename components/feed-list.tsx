import { InlineComments } from '@/components/inline-comments';
import { initialComments } from '@/lib/comments';
import { DocumentAttachment } from '@/components/document-attachment';
import { PostBody } from '@/components/post-body';
import Link from 'next/link';
import { deletePost } from '@/app/(app)/feed/actions';
import { PostVoteControls } from '@/components/post-vote-controls';
import type { Actor, FeedPost } from '@/lib/social';
import { relativeDate } from '@/lib/social';
import { PostAudienceBadge } from '@/components/post-audience-badge';

export async function FeedList({posts,actors,returnTo}:{posts:FeedPost[];actors:Actor[];returnTo:string}) {
 const comments=await initialComments(posts.map(p=>p.id));
 if(!posts.length)return <p className="glass rounded-xl p-6 text-muted">No posts yet.</p>;
 return <div className="space-y-4">{posts.map(post=>{const canManage=actors.some(actor=>actor.id===post.actor_id);return <article key={post.id} className="glass relative rounded-2xl p-5">{canManage&&<details className="absolute right-4 top-4 z-10"><summary aria-label="Post actions" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-xl leading-none text-muted hover:bg-panel-raised hover:text-ink">⋯</summary><div className="absolute right-0 mt-2 min-w-36 rounded-xl border border-line bg-panel p-2 shadow-xl"><Link href={`/posts/${post.id}/edit`} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gold hover:bg-panel-raised">Edit post</Link><form action={deletePost}><input type="hidden" name="id" value={post.id}/><input type="hidden" name="return_to" value={returnTo}/><button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-panel-raised">Delete post</button></form></div></details>}<div className="flex flex-wrap items-center justify-between gap-2 pr-10"><p className="deck-label">{post.author_kind} · {relativeDate(post.created_at)}</p><PostAudienceBadge visibility={post.visibility}/></div><Link href={`/posts/${post.id}`} className="mt-2 block text-lg font-semibold hover:text-gold">{post.author_name}</Link>{post.body.trim()&&<PostBody body={post.body} mentions={post.mentions} className="mt-4"/>}
 {post.media_url&&post.media_type==='image'&&<img src={post.media_url} alt="" className="mt-4 h-auto w-full rounded-2xl border border-line object-contain"/>}
 {post.media_url&&post.media_type==='video'&&<video src={post.media_url} controls preload="none" className="mt-4 max-h-[560px] w-full rounded-2xl border border-line"/>}
 {post.media_url&&post.media_type==='document'&&post.media_path&&<DocumentAttachment url={post.media_url} path={post.media_path}/>}
 {post.repost_of_id&&<Link href={`/posts/${post.repost_of_id}`} className="mt-3 inline-block text-sm text-gold">Shared post →</Link>}
 <PostVoteControls postId={post.id} commentCount={post.comment_count} actors={actors} initialUpvotes={post.upvote_count??0} initialDownvotes={post.downvote_count??0} initialActorVotes={post.actor_votes??{}}/><InlineComments postId={post.id} actors={actors} initial={comments.get(post.id)??[]} total={post.comment_count}/></article>})}</div>;
}
