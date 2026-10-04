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
