'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function changeOrganizationAdminRole(form:FormData){
 const org=String(form.get('organization_id')??'');
 const profile=String(form.get('profile_id')??'');
 const role=String(form.get('role')??'');
 const returnTo='/aluna-admin/organization-admins';
 if(!uuid.test(org)||!uuid.test(profile)||!['admin','member'].includes(role))redirect(returnTo+'?error=validation');
 const {client}=await requireAlunaSuperAdmin();
 const {data,error}=await client.rpc('aluna_admin_set_organization_role',{p_organization:org,p_profile:profile,p_role:role});
 if(error||!data){
  console.error('[PR33 organization-role-change]',{code:error?.code??'empty_rpc_result',message:error?.message??'RPC returned no result',organization_id:org,requested_role:role});
  redirect(returnTo+'?error=role');
 }
 revalidatePath(returnTo);
 revalidatePath('/organizations/'+org);
 redirect(returnTo+'?status=role-updated');
}
