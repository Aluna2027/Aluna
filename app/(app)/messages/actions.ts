'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif']);
const videoTypes=new Set(['video/mp4','video/webm','video/quicktime']);
function ext(file:File){return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||(file.type.startsWith('image/')?'jpg':'mp4');}

export async function sendMessage(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const body=String(form.get('body')??'').trim(),sender_actor_id=String(form.get('sender_actor_id')??''),recipient=String(form.get('recipient_actor_id')??''),existing=String(form.get('conversation_id')??'');
 const raw=form.get('media');const media=raw instanceof File&&raw.size>0?raw:null;
 const media_type=media?(imageTypes.has(media.type)?'image':videoTypes.has(media.type)?'video':null):null;
 if((!body&&!media)||body.length>4000||(media&&(!media_type||media.size>50*1024*1024)))redirect('/messages?error=validation');
 let conversation_id=existing;
 if(!conversation_id){const {data,error}=await client.rpc('open_conversation',{p_sender:sender_actor_id,p_recipient:recipient});if(error||!data)redirect('/messages?error=permission');conversation_id=data;}
 let media_path:string|null=null;
 if(media&&media_type){
   media_path=`${user.id}/${conversation_id}/${crypto.randomUUID()}.${ext(media)}`;
   const {error:uploadError}=await client.storage.from('message-media').upload(media_path,media,{contentType:media.type});
   if(uploadError)redirect(`/messages?conversation=${conversation_id}&error=upload`);
 }
 const {error}=await client.from('direct_messages').insert({conversation_id,sender_actor_id,body:body||null,media_path,media_type});
 if(error)redirect('/messages?error=permission');
 revalidatePath('/messages');revalidatePath('/notifications');redirect(`/messages?conversation=${conversation_id}`);
}

export async function sendMessageInline(form:FormData):Promise<{ok:boolean;conversationId?:string;message?:{id:string;sender_actor_id:string;body:string|null;created_at:string;media_type:string|null;media_url?:string|null};error?:string}>{
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();if(!user)return {ok:false,error:'Please sign in again.'};
 const body=String(form.get('body')??'').trim();
 const sender_actor_id=String(form.get('sender_actor_id')??'');
 const recipient=String(form.get('recipient_actor_id')??'');
 const existing=String(form.get('conversation_id')??'');
 const raw=form.get('media');const media=raw instanceof File&&raw.size>0?raw:null;
 const media_type=media?(imageTypes.has(media.type)?'image':videoTypes.has(media.type)?'video':null):null;
 if((!body&&!media)||body.length>4000||(media&&(!media_type||media.size>50*1024*1024)))return {ok:false,error:'Write a message or attach a supported photo or video (up to 50 MB).'};
 let conversationId=existing;
 if(!conversationId){const result=await client.rpc('open_conversation',{p_sender:sender_actor_id,p_recipient:recipient});if(result.error||!result.data)return {ok:false,error:'Cannot open this conversation.'};conversationId=result.data;}
 let media_path:string|null=null;
 if(media&&media_type){
  media_path=`${user.id}/${conversationId}/${crypto.randomUUID()}.${ext(media)}`;
  const uploaded=await client.storage.from('message-media').upload(media_path,media,{contentType:media.type});
  if(uploaded.error)return {ok:false,error:'Could not upload that photo or video.'};
 }
 const result=await client.from('direct_messages').insert({conversation_id:conversationId,sender_actor_id,body:body||null,media_path,media_type}).select('id,sender_actor_id,body,created_at,media_type').single();
 if(result.error||!result.data)return {ok:false,error:'Could not send the message.'};
 const signed=media_path?await client.storage.from('message-media').createSignedUrl(media_path,3600):null;
 revalidatePath('/messages');revalidatePath('/notifications');
 return {ok:true,conversationId,message:{...result.data,media_url:signed?.data?.signedUrl??null}};
}
