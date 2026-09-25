import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ownedActors, type FeedPost } from '@/lib/social';
import { PostComposer } from '@/components/post-composer';
import { FeedList } from '@/components/feed-list';
export default async function Feed({searchParams}:{searchParams:Promise<{before?:string;before_id?:string;error?:string}>}) {
 const {before,before_id,error}=await searchParams;const client=await createClient();const actors=await ownedActors();
 const cursor=before&&!Number.isNaN(Date.parse(before))?before:null;
 const {data}=await client.rpc('feed_page',{p_following:false,p_before:cursor,p_before_id:before_id||null,p_limit:20});const posts=(data??[]) as FeedPost[];
 return <div className="mx-auto max-w-3xl space-y-6"><div><p className="deck-label">THE NETWORK</p><h1 className="mt-2 text-4xl">Global feed</h1><Link href="/following" className="mt-2 inline-block text-sm text-gold hover:underline">Following feed →</Link></div>{error&&<p role="alert" className="text-amber-300">Could not complete that action.</p>}<PostComposer actors={actors}/><FeedList posts={posts} actors={actors} returnTo="/feed"/>{posts.length===20&&<Link href={`/feed?before=${encodeURIComponent(posts[19].created_at)}&before_id=${posts[19].id}`} className="block text-center text-gold">Older posts →</Link>}</div>;
}
