'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function changeL4Verifier(formData:FormData){
 const {client}=await requireAlunaSuperAdmin();
 const profile=String(formData.get('profile_id')??'');
 const reason=String(formData.get('reason')??'').trim();
 const revoke=formData.get('action')==='revoke';
 const trainedOn=String(formData.get('trained_on')??'');
 if(!uuid.test(profile)||reason.length<20||reason.length>1000||(!revoke&&!/^\d{4}-\d{2}-\d{2}$/.test(trainedOn))){
  redirect('/aluna-admin/l4-verifiers?error=invalid');
 }
 const {error}=await client.rpc('pr45_set_l4_verifier',{
  p_profile:profile,p_trained_on:revoke?null:trainedOn,p_reason:reason,p_revoke:revoke
 });
 if(error)redirect('/aluna-admin/l4-verifiers?error=unable');
 revalidatePath('/aluna-admin/l4-verifiers');
 redirect('/aluna-admin/l4-verifiers?status=updated');
}
