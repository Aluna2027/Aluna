'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { type OrganizationType, organizationTabs, safeUrl } from '@/lib/profiles';
import { countrySet } from '@/lib/countries';

const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif']);
function ext(file:File){return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';}
function score(form:FormData,key:string){const raw=String(form.get(key)??'').trim();if(!raw)return null;const n=Number(raw);return Number.isFinite(n)&&n>=0&&n<=10&&Math.abs(n*10-Math.round(n*10))<0.0001?n:NaN;}
function newUrl(type:string,error:string){return `/organizations/new?error=${error}${['university','ngo','company'].includes(type)?`&type=${type}`:''}`;}

export async function createOrganization(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const name=String(form.get('name')??'').trim();const type=String(form.get('organization_type')??'') as OrganizationType;
 const country=String(form.get('country')??'').trim();
 const description=String(form.get('description')??'').trim();
 const raw=form.get('logo_file');const logo=raw instanceof File&&raw.size>0?raw:null;
 const total=score(form,'wba_total_score'),human=score(form,'wba_human_rights_score'),decent=score(form,'wba_decent_work_score'),ethics=score(form,'wba_acting_ethically_score');
 if(name.length<2||name.length>160||!countrySet.has(country)||description.length>3000||!(type in organizationTabs)||!!logo&&(!imageTypes.has(logo.type)||logo.size>5*1024*1024)||(type==='company'&&[total,human,decent,ethics].some(v=>Number.isNaN(v))))redirect(newUrl(type,'validation'));
 let logo_url:string|null=null;
 if(logo){const path=`${user.id}/organizations/${crypto.randomUUID()}.${ext(logo)}`;const {error}=await client.storage.from('profile-media').upload(path,logo,{contentType:logo.type});if(error)redirect(newUrl(type,'save'));logo_url=client.storage.from('profile-media').getPublicUrl(path).data.publicUrl;}
 const {data:id,error}=await client.rpc('create_organization_v2',{p_name:name,p_type:type,p_country:country,p_description:description||null});
 if(error||!id)redirect(newUrl(type,'save'));
 const update:Record<string,unknown>={};if(logo_url)update.logo_url=logo_url;
 if(type==='company'){update.wba_total_score=total;update.wba_human_rights_score=human;update.wba_decent_work_score=decent;update.wba_acting_ethically_score=ethics;}
 if(Object.keys(update).length){const {error:e}=await client.from('organizations').update(update).eq('id',id);if(e)redirect(`/organizations/${id}?error=save`);}
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


export async function removeOrganization(form:FormData) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/organizations');
 const {error}=await client.rpc('remove_organization',{p_organization:id});
 if(error)redirect(`/organizations/${id}?error=delete`);
 revalidatePath('/organizations');revalidatePath('/profile');redirect('/organizations');
}
