import Link from 'next/link';
import { deletePost } from '@/app/(app)/feed/actions';
import { PostVoteControls } from '@/components/post-vote-controls';
import type { Actor, FeedPost } from '@/lib/social';
import { relativeDate } from '@/lib/social';

export function FeedList({posts,actors,returnTo}:{posts:FeedPost[];actors:Actor[];returnTo:string}) {
 if(!posts.length)return <p className="glass rounded-xl p-6 text-muted">No posts yet.</p>;
 return <div className="space-y-4">{posts.map(post=>{const canManage=actors.some(actor=>actor.id===post.actor_id);return <article key={post.id} className="glass relative rounded-2xl p-5">{canManage&&<details className="absolute right-4 top-4 z-10"><summary aria-label="Post actions" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-xl leading-none text-muted hover:bg-panel-raised hover:text-ink">⋯</summary><div className="absolute right-0 mt-2 min-w-36 rounded-xl border border-line bg-panel p-2 shadow-xl"><Link href={`/posts/${post.id}/edit`} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gold hover:bg-panel-raised">Edit post</Link><form action={deletePost}><input type="hidden" name="id" value={post.id}/><input type="hidden" name="return_to" value={returnTo}/><button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-panel-raised">Delete post</button></form></div></details>}<p className="deck-label pr-10">{post.author_kind} · {relativeDate(post.created_at)}</p><Link href={`/posts/${post.id}`} className="mt-2 block text-lg font-semibold hover:text-gold">{post.author_name}</Link><p className="mt-4 whitespace-pre-wrap break-words text-ink">{post.body}</p>
 {post.media_url&&post.media_type==='image'&&<img src={post.media_url} alt="" className="mt-4 max-h-[560px] w-full rounded-2xl border border-line object-cover"/>}
 {post.media_url&&post.media_type==='video'&&<video src={post.media_url} controls preload="metadata" className="mt-4 max-h-[560px] w-full rounded-2xl border border-line"/>}
 {post.repost_of_id&&<Link href={`/posts/${post.repost_of_id}`} className="mt-3 inline-block text-sm text-gold">Shared post →</Link>}
 <PostVoteControls postId={post.id} commentCount={post.comment_count} actors={actors} initialUpvotes={post.upvote_count??0} initialDownvotes={post.downvote_count??0} initialActorVotes={post.actor_votes??{}}/></article>})}</div>;
}
