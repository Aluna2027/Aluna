'use server';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
function uuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
function content(form:FormData){const title=String(form.get('title')??'').trim(),story=String(form.get('story')??'').trim(),goal=String(form.get('goal')??'').trim();if(title.length<3||title.length>180||story.length<10||story.length>5000||!/^\d+(\.\d{1,2})?$/.test(goal)||Number(goal)<=0||Number(goal)>999_999_999_999.99)throw new Error('Invalid campaign');return {title,story,goal_amount:Number(goal)};}
async function authenticated(){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');return client;}
export async function createCampaign(form:FormData){const client=await authenticated();let fields;try{fields=content(form);}catch{redirect('/fundraising/campaigns/new?error=validation');}
 const mission_id=String(form.get('mission_id')??''),actor_id=String(form.get('actor_id')??'');if(!uuid(mission_id)||!uuid(actor_id))redirect('/fundraising/campaigns/new?error=validation');
 const actors=await ownedActors();if(!actors.some(actor=>actor.id===actor_id))redirect('/fundraising/campaigns/new?error=owner');
 const {data:mission}=await client.from('missions').select('currency_code').eq('id',mission_id).maybeSingle();if(!mission)redirect('/fundraising/campaigns/new?error=mission');
 const {data,error}=await client.from('fundraising_campaigns').insert({...fields,mission_id,actor_id,currency_code:mission.currency_code}).select('id').single();if(error||!data)redirect('/fundraising/campaigns/new?error=save');revalidatePath('/fundraising');redirect(`/fundraising/campaigns/${data.id}`);
}
export async function editCampaign(form:FormData){const client=await authenticated();const id=String(form.get('id')??'');if(!uuid(id))redirect('/fundraising');let fields;try{fields=content(form);}catch{redirect(`/fundraising/campaigns/${id}/edit?error=validation`);}
 const {data,error}=await client.from('fundraising_campaigns').update({...fields,updated_at:new Date().toISOString()}).eq('id',id).select('id').maybeSingle();if(error||!data)redirect(`/fundraising/campaigns/${id}/edit?error=save`);revalidatePath(`/fundraising/campaigns/${id}`);redirect(`/fundraising/campaigns/${id}`);
}
export async function createFundraiser(form:FormData){const client=await authenticated();const campaign_id=String(form.get('campaign_id')??''),actor_id=String(form.get('actor_id')??''),kind=String(form.get('kind')??'');if(!uuid(campaign_id)||!uuid(actor_id)||!['personal','team'].includes(kind))redirect('/fundraising/new?error=validation');
 let fields;try{fields=content(form);}catch{redirect(`/fundraising/new?campaign=${campaign_id}&error=validation`);}
 const {data:campaign}=await client.from('fundraising_campaigns').select('mission_id').eq('id',campaign_id).maybeSingle();if(!campaign)redirect('/fundraising/new?error=campaign');
 const slug=`${fields.title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70).replace(/-$/,'')||'fundraiser'}-${randomUUID().slice(0,8)}`;
 const referral=(await cookies()).get('aluna_referral')?.value??'';const [token,source]=referral.split('.');
 const {error}=await client.rpc('create_referred_fundraiser',{p_campaign:campaign_id,p_actor:actor_id,p_kind:kind,p_slug:slug,p_title:fields.title,p_story:fields.story,p_goal:fields.goal_amount,p_ref_token:/^[a-f0-9]{32}$/.test(token)?token:null,p_source:source||'direct'});if(error)redirect(`/fundraising/new?campaign=${campaign_id}&error=save`);revalidatePath(`/fundraising/campaigns/${campaign_id}`);redirect(`/fundraising/${slug}`);
}
export async function editFundraiser(form:FormData){const client=await authenticated();const id=String(form.get('id')??''),slug=String(form.get('slug')??'');if(!uuid(id)||!/^[a-z0-9-]{1,100}$/.test(slug))redirect('/fundraising');let fields;try{fields=content(form);}catch{redirect(`/fundraising/${slug}/edit?error=validation`);}
 const {data,error}=await client.from('fundraisers').update({...fields,updated_at:new Date().toISOString()}).eq('id',id).eq('slug',slug).select('id').maybeSingle();if(error||!data)redirect(`/fundraising/${slug}/edit?error=save`);revalidatePath(`/fundraising/${slug}`);redirect(`/fundraising/${slug}`);
}
export async function joinFundraisingTeam(form:FormData){const client=await authenticated();const fundraiser_id=String(form.get('fundraiser_id')??''),actor_id=String(form.get('actor_id')??''),slug=String(form.get('slug')??'');if(!uuid(fundraiser_id)||!uuid(actor_id)||!/^[a-z0-9-]{1,100}$/.test(slug))redirect('/fundraising');const {error}=await client.from('fundraiser_team_members').insert({fundraiser_id,actor_id});if(error)redirect(`/fundraising/${slug}?error=team`);revalidatePath(`/fundraising/${slug}`);redirect(`/fundraising/${slug}`);}
export async function postFundraisingUpdate(form:FormData){const client=await authenticated();const fundraiser_id=String(form.get('fundraiser_id')??''),actor_id=String(form.get('actor_id')??''),slug=String(form.get('slug')??''),body=String(form.get('body')??'').trim();if(!uuid(fundraiser_id)||!uuid(actor_id)||!/^[a-z0-9-]{1,100}$/.test(slug)||!body||body.length>5000)redirect('/fundraising');const {error}=await client.from('fundraiser_updates').insert({fundraiser_id,actor_id,body});if(error)redirect(`/fundraising/${slug}?error=update`);revalidatePath(`/fundraising/${slug}`);redirect(`/fundraising/${slug}`);}
export async function commentOnFundraiser(form:FormData){const client=await authenticated();const fundraiser_id=String(form.get('fundraiser_id')??''),actor_id=String(form.get('actor_id')??''),slug=String(form.get('slug')??''),body=String(form.get('body')??'').trim();if(!uuid(fundraiser_id)||!uuid(actor_id)||!/^[a-z0-9-]{1,100}$/.test(slug)||!body||body.length>2000)redirect('/fundraising');const {error}=await client.from('fundraiser_comments').insert({fundraiser_id,actor_id,body});if(error)redirect(`/fundraising/${slug}?error=comment`);revalidatePath(`/fundraising/${slug}`);redirect(`/fundraising/${slug}`);}
