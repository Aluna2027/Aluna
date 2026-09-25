import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ownedActors, type FeedPost } from '@/lib/social';
import { FeedList } from '@/components/feed-list';
export default async function Following({searchParams}:{searchParams:Promise<{before?:string;before_id?:string}>}) {
 const {before,before_id}=await searchParams;const client=await createClient();const actors=await ownedActors();const cursor=before&&!Number.isNaN(Date.parse(before))?before:null;
 const {data}=await client.rpc('feed_page',{p_following:true,p_before:cursor,p_before_id:before_id||null,p_limit:20});const posts=(data??[]) as FeedPost[];
 return <div className="mx-auto max-w-3xl space-y-6"><div><p className="deck-label">YOUR NETWORK</p><h1 className="mt-2 text-4xl">Following feed</h1><Link href="/feed" className="mt-2 inline-block text-sm text-gold hover:underline">← Global feed</Link></div><FeedList posts={posts} actors={actors} returnTo="/following"/>{posts.length===20&&<Link href={`/following?before=${encodeURIComponent(posts[19].created_at)}&before_id=${posts[19].id}`} className="block text-center text-gold">Older posts →</Link>}</div>;
}
