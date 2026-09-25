'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { type OrganizationType, organizationTabs, safeUrl } from '@/lib/profiles';

export async function createOrganization(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const name=String(form.get('name')??'').trim();const type=String(form.get('organization_type')??'') as OrganizationType;
 const description=String(form.get('description')??'').trim();
 if(name.length<2||name.length>160||description.length>3000||!(type in organizationTabs))redirect('/organizations/new?error=validation');
 const {data:id,error}=await client.rpc('create_organization',{p_name:name,p_type:type,p_description:description||null});
 if(error||!id)redirect('/organizations/new?error=save');
 revalidatePath('/organizations');revalidatePath('/profile');
 redirect(`/organizations/${id}`);
}

export async function updateOrganization(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/organizations');
 const {data:membership}=await client.from('organization_members').select('member_role').eq('organization_id',id).eq('profile_id',user.id).maybeSingle();
 if(membership?.member_role!=='admin')redirect(`/organizations/${id}`);
 const name=String(form.get('name')??'').trim(),description=String(form.get('description')??'').trim(),website=String(form.get('website')??'').trim(),location_text=String(form.get('location_text')??'').trim(),logo_url=String(form.get('logo_url')??'').trim();
 if(name.length<2||name.length>160||description.length>3000||website.length>300||location_text.length>160||(website&&!safeUrl(website))||logo_url.length>500||(logo_url&&!safeUrl(logo_url)))redirect(`/organizations/${id}/edit?error=validation`);
 const {error}=await client.from('organizations').update({name,description:description||null,website:website||null,location_text:location_text||null,logo_url:logo_url||null,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)redirect(`/organizations/${id}/edit?error=save`);
 revalidatePath('/organizations');revalidatePath(`/organizations/${id}`);revalidatePath('/profile');
 redirect(`/organizations/${id}?status=saved`);
}
