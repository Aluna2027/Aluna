import { Newspaper } from 'lucide-react';
import { iconColors } from '@/lib/icon-colors';
import { createClient } from '@/lib/supabase/server';
import { ownedActors, attachPostMedia, attachVoteCounts, type FeedPost } from '@/lib/social';
import { PostComposer } from '@/components/post-composer';
import { FeedList } from '@/components/feed-list';

export async function OrganizationPosts({actorId,name,kind,isAdmin,organizationId}:{actorId:string;name:string;kind:string;isAdmin:boolean;organizationId:string}) {
 const client=await createClient();
 const actors=await ownedActors();
 const authorActors=isAdmin?actors.filter(a=>a.id===actorId):[];
 const {data,error}=await client.from('posts')
  .select('id,actor_id,body,visibility,repost_of_id,created_at,media_path,media_type')
  .eq('actor_id',actorId).order('created_at',{ascending:false}).limit(20);
 const ids=(data??[]).map(p=>p.id);
 const {data:comments}=ids.length?await client.from('comments').select('post_id').in('post_id',ids):{data:[]};
 const counts=new Map<string,number>();
 for(const row of comments??[])counts.set(row.post_id,(counts.get(row.post_id)??0)+1);
 const feed=(data??[]).map(p=>({...p,author_name:name,author_kind:kind,comment_count:counts.get(p.id)??0,reaction_count:0})) as FeedPost[];
 const posts=await attachPostMedia(await attachVoteCounts(feed,actors));
 return <section className="space-y-4">
  <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4"><Newspaper size={24} color={iconColors.posts}/><h2 className="text-xl font-semibold">Posts</h2></div>
  {isAdmin&&<PostComposer actors={authorActors} returnTo={`/organizations/${organizationId}?tab=posts`}/>}
  {error?<p role="alert">Could not load posts.</p>:<FeedList posts={posts} actors={actors} returnTo={`/organizations/${organizationId}?tab=posts`}/>}
 </section>;
}
