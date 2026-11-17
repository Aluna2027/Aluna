import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { extractHashtags } from '@/lib/post-text';
import { actorDetails, attachPostMedia, attachVoteCounts, ownedActors, type FeedPost } from '@/lib/social';
import { FeedList } from '@/components/feed-list';

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: supplied } = await params;
  const tag = supplied.normalize('NFKC').toLowerCase();
  if (!/^[\p{L}\p{N}_]{1,64}$/u.test(tag)) notFound();

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) notFound();

  // Indexed post_hashtags respects each post's read permission via RLS.
  // Preview fallback remains available until the reviewed migration is applied.
  const { data: references, error: indexError } = await client.from('post_hashtags')
    .select('post_id,created_at').eq('tag', tag)
    .order('created_at', { ascending: false }).limit(50);
  const ids = (references ?? []).map(row => row.post_id);
  const indexed = !indexError;
  const { data: matches, error } = indexed
    ? ids.length
      ? await client.from('posts')
          .select('id,actor_id,body,visibility,repost_of_id,created_at,media_path,media_type')
          .in('id', ids)
      : { data: [], error: null }
    : await client.from('posts')
        .select('id,actor_id,body,visibility,repost_of_id,created_at,media_path,media_type')
        .ilike('body', '%#' + tag.replace(/[%_\\]/g, '') + '%')
        .order('created_at', { ascending: false }).limit(100);
  const rows = (matches ?? []).filter(post => extractHashtags(post.body)
    .some(item => item.key === tag));
  const byId = new Map(rows.map(row => [row.id,row]));
  const selected = indexed
    ? ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []).slice(0,20)
    : rows.slice(0,20);
  const authors = await actorDetails(selected.map(post => post.actor_id));
  const feed = selected.map(post => ({
    ...post,
    author_name: authors.get(post.actor_id)?.name ?? 'Member',
    author_kind: authors.get(post.actor_id)?.kind ?? 'user',
    reaction_count: 0,
    comment_count: 0,
  })) as FeedPost[];
  const actors = await ownedActors();
  const posts = await attachPostMedia(await attachVoteCounts(feed, actors));

  return <main className="mx-auto max-w-3xl space-y-5">
    <Link href="/feed" className="text-sm text-gold">← Global Feed</Link>
    <h1 className="text-3xl font-semibold">#{tag}</h1>
    <p className="text-sm text-muted">Posts visible to your account across Aluna.</p>
    {error ? <p role="alert">Could not load hashtag posts.</p> :
      <FeedList posts={posts} actors={actors} returnTo="/feed" />}
  </main>;
}
