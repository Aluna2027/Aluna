import 'server-only';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {createHash,randomBytes} from 'node:crypto';
export const idPattern=/^[0-9a-f-]{36}$/i;
export function adminDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Missing Supabase server configuration');
 return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function tokenHash(t:string){return createHash('sha256').update(t).digest('hex');}
export function newToken(){return randomBytes(32).toString('hex');}
export async function verifiedIdentity(){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user?.email||!user.email_confirmed_at)return null;
 return {user,email:user.email.trim().toLowerCase(),client};
}
export async function superAdmin(client:Awaited<ReturnType<typeof createClient>>){
 const {data,error}=await client.rpc('is_aluna_super_admin');
 return !error&&data===true;
}
