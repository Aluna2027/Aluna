'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export async function sendMessage(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const body=String(form.get('body')??'').trim(),sender_actor_id=String(form.get('sender_actor_id')??''),recipient=String(form.get('recipient_actor_id')??''),existing=String(form.get('conversation_id')??'');
 if(!body||body.length>4000)redirect('/messages?error=validation');
 let conversation_id=existing;
 if(!conversation_id){const {data,error}=await client.rpc('open_conversation',{p_sender:sender_actor_id,p_recipient:recipient});if(error||!data)redirect('/messages?error=permission');conversation_id=data;}
 const {error}=await client.from('direct_messages').insert({conversation_id,sender_actor_id,body});
 if(error)redirect('/messages?error=permission');
 revalidatePath('/messages');revalidatePath('/notifications');redirect(`/messages?conversation=${conversation_id}`);
}
