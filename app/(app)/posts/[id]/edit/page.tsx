import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { fromDatabaseMentions } from '@/lib/post-annotations';
import { PostEditForm } from '@/components/post-edit-form';
export default async function EditPost({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();const {data:post}=await client.from('posts').select('id,actor_id,body,media_path,media_type,city_hashtag_refs').eq('id',id).maybeSingle();if(!post)notFound();
 const owned=await ownedActors();if(!owned.some(a=>a.id===post.actor_id))notFound();
 const {data:referenceRows,error:referenceError}=await client.from('post_mentions')
   .select('actor_id,start_offset,label').eq('post_id',id);
 const annotationsEnabled=!referenceError;
 return <div className="mx-auto max-w-3xl space-y-5"><Link href={`/posts/${id}`} className="text-gold">← Post</Link><Card title="Edit post">{error&&<p role="alert" className="mb-4 text-amber-300">Could not save your post.</p>}<PostEditForm id={id} body={post.body} mentions={fromDatabaseMentions(post.body,referenceRows??[])} annotationsEnabled={annotationsEnabled} cityHashtagRefs={post.city_hashtag_refs} requiresText={!post.media_path||!(post.media_type==="image"||post.media_type==="video")}/></Card></div>;
}
