import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, attachPostMedia, attachVoteCounts, ownedActors, type FeedPost } from '@/lib/social';
import { FeedList } from '@/components/feed-list';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function HashtagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ before?: string; before_id?: string }>;
}) {
  const [{ tag: supplied }, cursor] = await Promise.all([params, searchParams]);
  const tag = supplied.normalize('NFKC').toLowerCase();
  if (!/^[\p{L}\p{N}_]{1,64}$/u.test(tag)) notFound();

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) notFound();

  let query = client.from('post_hashtags')
    .select('post_id,created_at')
    .eq('tag', tag)
    .order('created_at', { ascending: false })
    .order('post_id', { ascending: false });
  if (cursor.before) {
    const date = new Date(cursor.before);
    if (!Number.isFinite(date.getTime())) redirect(`/hashtags/${encodeURIComponent(tag)}`);
    const timestamp = date.toISOString();
    if (cursor.before_id && uuid.test(cursor.before_id)) {
      query = query.or(`created_at.lt.${timestamp},and(created_at.eq.${timestamp},post_id.lt.${cursor.before_id})`);
    } else {
      query = query.lt('created_at', timestamp);
    }
  }
  const { data: references, error: indexError } = await query.limit(21);
  const pageReferences = references ?? [];
  const hasMore = pageReferences.length > 20;
  const visibleReferences = pageReferences.slice(0, 20);
  const ids = visibleReferences.map(row => row.post_id);
  const { data: matches, error } = ids.length
    ? await client.from('posts')
        .select('id,actor_id,body,visibility,repost_of_id,created_at,media_path,media_type')
        .in('id', ids)
    : { data: [], error: null };
  const byId = new Map((matches ?? []).map(post => [post.id, post]));
  // Reconstruct the index order because `.in()` does not preserve input ordering.
  const selected = visibleReferences.flatMap(reference => {
    const post = byId.get(reference.post_id);
    return post ? [post] : [];
  });
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
  const last = visibleReferences.at(-1);

  return <main className="mx-auto max-w-3xl space-y-5">
    <Link href="/feed" className="text-sm text-gold">← Global Feed</Link>
    <h1 className="text-3xl font-semibold">#{tag}</h1>
    <p className="text-sm text-muted">Posts visible to your account across Aluna.</p>
    {indexError || error ? <p role="alert">Could not load hashtag posts. The search index may not be available yet.</p> : <>
      <FeedList posts={posts} actors={actors} returnTo="/feed" />
      {hasMore && last && <Link
        href={`/hashtags/${encodeURIComponent(tag)}?before=${encodeURIComponent(last.created_at)}&before_id=${last.post_id}`}
        className="block text-center text-gold"
      >Older posts →</Link>}
    </>}
  </main>;
}
