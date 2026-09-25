'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function destination(form:FormData) {const path=String(form.get('return_to')??'/feed');if(/^\/(communities|missions)\/[0-9a-f-]{36}$/i.test(path))return `${path}?tab=${path.startsWith('/missions/')?'posts':'feed'}`;return /^\/(feed|following|posts\/[0-9a-f-]{36}|people\/[0-9a-f-]{36}|organizations\/[0-9a-f-]{36})$/i.test(path)?path:'/feed';}
function withError(path:string,error:string){return `${path}${path.includes('?')?'&':'?'}error=${error}`;}
async function current() {const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');return client;}
function bodyText(form:FormData,key:string,max:number){const value=String(form.get(key)??'').trim();return value.length>=1&&value.length<=max?value:null;}
export async function createPost(form:FormData) {
 const client=await current(),returnTo=destination(form);const body=bodyText(form,'body',5000);if(!body)redirect(withError(returnTo,'post'));
 const actor_id=String(form.get('actor_id')??'');const visibility=form.get('visibility')==='followers'?'followers':'public';
 const repost_of_id=String(form.get('repost_of_id')??'')||null;
 const community_id=String(form.get('community_id')??'')||null;
 const mission_id=String(form.get('mission_id')??'')||null;
 const {error}=await client.from('posts').insert({actor_id,body,visibility:community_id||mission_id?'public':visibility,repost_of_id,community_id,mission_id});if(error)redirect(withError(returnTo,'post'));
 revalidatePath('/feed');revalidatePath('/following');redirect(returnTo);
}
export async function addComment(form:FormData) {
 const client=await current(),returnTo=destination(form);const body=bodyText(form,'body',2000);if(!body)redirect(withError(returnTo,'comment'));
 const post_id=String(form.get('post_id')??''),actor_id=String(form.get('actor_id')??'');
 const {error}=await client.from('comments').insert({post_id,actor_id,body});if(error)redirect(withError(returnTo,'comment'));
 revalidatePath(`/posts/${post_id}`);revalidatePath('/feed');redirect(returnTo);
}
export async function toggleReaction(form:FormData) {
 const client=await current(),returnTo=destination(form);const post_id=String(form.get('post_id')??''),actor_id=String(form.get('actor_id')??'');
 const {data}=await client.from('reactions').select('post_id').eq('post_id',post_id).eq('actor_id',actor_id).maybeSingle();
 const {error}=data?await client.from('reactions').delete().eq('post_id',post_id).eq('actor_id',actor_id):await client.from('reactions').insert({post_id,actor_id});
 if(error)redirect(withError(returnTo,'reaction'));revalidatePath('/feed');revalidatePath(`/posts/${post_id}`);redirect(returnTo);
}
export async function toggleFollow(form:FormData) {
 const client=await current(),returnTo=destination(form);const follower_actor_id=String(form.get('actor_id')??''),followed_actor_id=String(form.get('target_actor_id')??'');
 const {data}=await client.from('follows').select('follower_actor_id').eq('follower_actor_id',follower_actor_id).eq('followed_actor_id',followed_actor_id).maybeSingle();
 const {error}=data?await client.from('follows').delete().eq('follower_actor_id',follower_actor_id).eq('followed_actor_id',followed_actor_id):await client.from('follows').insert({follower_actor_id,followed_actor_id});
 if(error)redirect(withError(returnTo,'follow'));revalidatePath('/following');revalidatePath(returnTo);redirect(returnTo);
}
export async function requestConnection(form:FormData) {
 const client=await current(),returnTo=destination(form);const requested_by=String(form.get('actor_id')??''),other=String(form.get('target_actor_id')??'');
 if(requested_by===other||!requested_by||!other)redirect(returnTo);
 const [actor_a,actor_b]=[requested_by,other].sort();const {error}=await client.from('connections').insert({actor_a,actor_b,requested_by});
 if(error)redirect(withError(returnTo,'connection'));revalidatePath(returnTo);redirect(returnTo);
}
export async function respondConnection(form:FormData) {
 const client=await current(),returnTo=destination(form);const actor_a=String(form.get('actor_a')??''),actor_b=String(form.get('actor_b')??'');const status=form.get('status')==='accepted'?'accepted':'declined';
 const {error}=await client.from('connections').update({status,updated_at:new Date().toISOString()}).eq('actor_a',actor_a).eq('actor_b',actor_b);
 if(error)redirect(withError(returnTo,'connection'));revalidatePath(returnTo);redirect(returnTo);
}

export async function editPost(form:FormData) {
 const client=await current();const id=String(form.get('id')??'');const body=bodyText(form,'body',5000);
 if(!body)redirect(`/posts/${id}/edit?error=validation`);
 const {error}=await client.from('posts').update({body,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)redirect(`/posts/${id}/edit?error=save`);
 revalidatePath(`/posts/${id}`);revalidatePath('/feed');redirect(`/posts/${id}`);
}
export async function deletePost(form:FormData) {
 const client=await current();const id=String(form.get('id')??'');
 const {error}=await client.from('posts').delete().eq('id',id);if(error)redirect(`/posts/${id}?error=delete`);
 revalidatePath('/feed');revalidatePath('/following');redirect('/feed');
}
export async function deleteComment(form:FormData) {
 const client=await current();const id=String(form.get('id')??''),postId=String(form.get('post_id')??'');
 const {error}=await client.from('comments').delete().eq('id',id);if(error)redirect(`/posts/${postId}?error=comment`);
 revalidatePath(`/posts/${postId}`);redirect(`/posts/${postId}`);
}
