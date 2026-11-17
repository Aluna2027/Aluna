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

  // RLS remains the source of truth. Matching the parsed tag again prevents
  // #SDG9 accidentally matching #SDG90 or appearing inside a larger word.
  // A bounded search is used until the approved indexed PR47 migration lands.
  const { data: matches, error } = await client.from('posts')
    .select('id,actor_id,body,visibility,repost_of_id,created_at,media_path,media_type')
    .ilike('body', '%#' + tag.replace(/[%_\\]/g, '') + '%')
    .order('created_at', { ascending: false })
    .limit(100);
  const selected = (matches ?? []).filter(post => extractHashtags(post.body)
    .some(item => item.key === tag)).slice(0, 20);
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
