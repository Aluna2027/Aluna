import Link from 'next/link';
import { toggleReaction } from '@/app/(app)/feed/actions';
import { ShareLink } from '@/components/share-link';
import type { Actor, FeedPost } from '@/lib/social';
import { relativeDate } from '@/lib/social';
export function FeedList({posts,actors,returnTo}:{posts:FeedPost[];actors:Actor[];returnTo:string}) {
 if(!posts.length)return <p className="glass rounded-xl p-6 text-muted">No posts yet.</p>;
 return <div className="space-y-4">{posts.map(post=><article key={post.id} className="glass rounded-2xl p-5"><p className="deck-label">{post.author_kind} · {relativeDate(post.created_at)}</p><Link href={`/posts/${post.id}`} className="mt-2 block text-lg font-semibold hover:text-gold">{post.author_name}</Link><p className="mt-4 whitespace-pre-wrap break-words text-ink">{post.body}</p>{post.repost_of_id&&<Link href={`/posts/${post.repost_of_id}`} className="mt-3 inline-block text-sm text-gold">Shared post →</Link>}
 <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-line pt-3 text-sm text-muted"><Link href={`/posts/${post.id}`}>{post.comment_count} comments</Link><span>{post.reaction_count} reactions</span><ShareLink path={`/posts/${post.id}`}/>{actors.length>0&&<form action={toggleReaction} className="flex gap-2"><input type="hidden" name="post_id" value={post.id}/><input type="hidden" name="return_to" value={returnTo}/><select name="actor_id" aria-label="React as" className="rounded-lg border border-line bg-panel-raised p-1 text-ink">{actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="text-gold hover:underline">React / Undo</button></form>}</div></article>)}</div>;
}
