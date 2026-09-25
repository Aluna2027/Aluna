import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { Card } from '@/components/ui';
import { editPost } from '@/app/(app)/feed/actions';
export default async function EditPost({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
 const {id}=await params;const {error}=await searchParams;const client=await createClient();const {data:post}=await client.from('posts').select('id,actor_id,body').eq('id',id).maybeSingle();if(!post)notFound();
 const owned=await ownedActors();if(!owned.some(a=>a.id===post.actor_id))notFound();
 return <div className="mx-auto max-w-3xl space-y-5"><Link href={`/posts/${id}`} className="text-gold">← Post</Link><Card title="Edit post">{error&&<p role="alert" className="mb-4 text-amber-300">Could not save your post.</p>}<form action={editPost} className="space-y-4"><input type="hidden" name="id" value={id}/><textarea name="body" required maxLength={5000} rows={7} defaultValue={post.body} className="w-full rounded-xl border border-line bg-panel-raised p-3 text-ink"/><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Save post</button></form></Card></div>;
}
