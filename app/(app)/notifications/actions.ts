'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export async function markNotificationRead(form:FormData) {
 const id=String(form.get('id')??'');const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 await client.from('notifications').update({is_read:true}).eq('id',id);
 revalidatePath('/notifications');redirect('/notifications');
}
