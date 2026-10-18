'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Resource='community'|'mission'|'campaign';
const tab:Record<Resource,string>={community:'wi-fi-mesh',mission:'missions',campaign:'fundraising'};

export async function removeOrganizationCard(form:FormData){
 const orgId=String(form.get('organization_id')??'');
 const id=String(form.get('id')??'');
 const resource=String(form.get('resource')??'') as Resource;
 if(!uuid.test(orgId)||!uuid.test(id)||!Object.prototype.hasOwnProperty.call(tab,resource)){
  redirect('/organizations');
 }
 const returnTo=`/organizations/${orgId}?tab=${tab[resource]}&manage=1`;
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login');
 const [{data:membership},{data:actor}]=await Promise.all([
  client.from('organization_members').select('member_role')
   .eq('organization_id',orgId).eq('profile_id',user.id).maybeSingle(),
  client.from('actors').select('id').eq('organization_id',orgId).maybeSingle()
 ]);
 if(membership?.member_role!=='admin'||!actor)redirect(returnTo+'&error=not-authorized');

 let owner=false;
 if(resource==='community'){
  const {data:steward}=await client.from('mesh_community_members').select('community_id')
   .eq('community_id',id).eq('actor_id',actor.id).eq('member_role','steward').maybeSingle();
  const {data:community}=await client.from('mesh_communities').select('id')
   .eq('id',id).is('removed_at',null).maybeSingle();
  owner=!!steward&&!!community;
 }else if(resource==='mission'){
  const {data:mission}=await client.from('missions').select('id')
   .eq('id',id).eq('created_by_actor_id',actor.id).is('removed_at',null).maybeSingle();
  owner=!!mission;
 }else{
  const {data:campaign}=await client.from('fundraising_campaigns').select('id')
   .eq('id',id).eq('actor_id',actor.id).is('removed_at',null).is('archived_at',null).maybeSingle();
  owner=!!campaign;
 }
 if(!owner)redirect(returnTo+'&error=not-authorized');
 const {data,error}=resource==='community'
  ?await client.rpc('remove_mesh_community',{p_community:id})
  :resource==='mission'
   ?await client.rpc('remove_mission',{p_mission:id})
   :await client.rpc('remove_or_archive_campaign',{p_campaign:id});
 if(error)redirect(returnTo+'&error=delete');
 revalidatePath('/communities');
 revalidatePath('/missions');
 revalidatePath('/fundraising');
 revalidatePath('/fundraising/performance');
 revalidatePath('/world-map');
 revalidatePath(`/organizations/${orgId}`);
 revalidatePath(resource==='community'?`/communities/${id}`:resource==='mission'?`/missions/${id}`:`/fundraising/campaigns/${id}`);
 redirect(returnTo+`&status=${resource==='campaign'&&data==='archived'?'archived':'deleted'}`);
}
