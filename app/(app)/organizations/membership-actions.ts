'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function admin(client:Awaited<ReturnType<typeof createClient>>,org:string){
 const {data:{user}}=await client.auth.getUser();
 if(!user||!uuid.test(org))return false;
 const {data}=await client.from('organization_members').select('member_role').eq('organization_id',org).eq('profile_id',user.id).maybeSingle();
 return data?.member_role==='admin';
}
export async function requestOrganizationMembership(form:FormData){
 const org=String(form.get('organization_id')??'');
 if(!uuid.test(org))redirect('/organizations');
 const client=await createClient(),{data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login');
 const {error}=await client.from('organization_membership_requests').insert({organization_id:org,requester_id:user.id,status:'pending'});
 revalidatePath('/notifications');revalidatePath('/organizations/'+org);
 redirect('/organizations/'+org+'?tab=members'+(error?'&error=membership':'&status=membership-requested'));
}
export async function reviewOrganizationMembership(form:FormData){
 const org=String(form.get('organization_id')??''),request=String(form.get('request_id')??''),decision=String(form.get('decision')??'');
 if(!uuid.test(org)||!uuid.test(request)||!['accepted','declined'].includes(decision))redirect('/organizations');
 const client=await createClient();
 if(!await admin(client,org))redirect('/organizations/'+org+'?tab=members');
 const {data:row}=await client.from('organization_membership_requests').select('organization_id').eq('id',request).eq('organization_id',org).maybeSingle();
 if(!row)redirect('/organizations/'+org+'?tab=members&manage=1&error=review');
 const {data,error}=await client.rpc('review_organization_membership',{p_request:request,p_decision:decision});
 revalidatePath('/organizations/'+org);
 redirect('/organizations/'+org+'?tab=members&manage=1'+(error||!data?'&error=review':'&status=member-reviewed'));
}
export async function saveOrganizationRelationship(form:FormData){
 const org=String(form.get('organization_id')??''),kind=String(form.get('kind')??''),name=String(form.get('name')??'').trim(),id=String(form.get('id')??'');
 const destination='/organizations/'+org+'?tab=connections&manage=1';
 if(!uuid.test(org)||!['partnership','sponsorship'].includes(kind)||name.length<2||name.length>160||id&&!uuid.test(id))redirect('/organizations');
 const client=await createClient();
 if(!await admin(client,org))redirect('/organizations/'+org+'?tab=connections');
 const participants=String(form.get('participants')??'').split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean);
 if(participants.length>30||participants.some(x=>!uuid.test(x)))redirect(destination+'&error=relationship');
 const {error}=await client.rpc('save_organization_relationship',{p_organization:org,p_kind:kind,p_name:name,p_actors:participants,p_id:id||null});
 revalidatePath('/organizations/'+org);
 redirect(destination+(error?'&error=relationship':'&status=relationship-saved'));
}
export async function deleteOrganizationRelationship(form:FormData){
 const org=String(form.get('organization_id')??''),id=String(form.get('id')??'');
 if(!uuid.test(org)||!uuid.test(id))redirect('/organizations');
 const client=await createClient();
 if(!await admin(client,org))redirect('/organizations/'+org+'?tab=connections');
 const {error}=await client.rpc('delete_organization_relationship',{p_organization:org,p_id:id});
 revalidatePath('/organizations/'+org);
 redirect('/organizations/'+org+'?tab=connections&manage=1'+(error?'&error=relationship':'&status=relationship-deleted'));
}
