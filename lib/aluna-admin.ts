import 'server-only';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {adminDb} from '@/lib/org-access';

export async function requireAlunaSuperAdmin(){
 const client=await createClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)redirect('/login');
 const {data:isAdmin,error:roleError}=await client.rpc('is_aluna_super_admin');
 if(roleError||isAdmin!==true)redirect('/organizations');
 return {user,client,db:adminDb()};
}

export function adminSearch(query:string|undefined){
 return (query??'').trim().replace(/[%,()\\]/g,'').slice(0,80);
}
