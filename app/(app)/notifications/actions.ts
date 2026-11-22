'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export async function viewNotification(form:FormData) {
 const id=String(form.get('id')??'');const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const destination=String(form.get('destination')??'');
 if(!/^\/(?:posts\/[0-9a-f-]{36}|messages\?conversation=[0-9a-f-]{36}|organizations\/[0-9a-f-]{36}(?:\?tab=members&manage=1)?|people\/[0-9a-f-]{36}|profile|notifications)$/i.test(destination))redirect('/notifications?error=destination');
 const {data,error}=await client.from('notifications').update({is_read:true}).eq('id',id).select('id').maybeSingle();
 if(error||!data)redirect('/notifications?error=read');
 revalidatePath('/notifications');revalidatePath('/', 'layout');redirect(destination);
}
