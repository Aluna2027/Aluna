'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const valid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function clientFor(actorId:string){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return null;
 const {data:owned}=await client.from('actors').select('id').eq('id',actorId).eq('profile_id',user.id).maybeSingle();
 if(owned)return client;
 const {data:actor}=await client.from('actors').select('organization_id').eq('id',actorId).maybeSingle();
 if(!actor?.organization_id)return null;
 const {data:member}=await client.from('organization_members').select('member_role').eq('profile_id',user.id).eq('organization_id',actor.organization_id).eq('member_role','admin').maybeSingle();
 return member?client:null;
}
export async function setProfileFollow(input:{actorId:string;targetActorId:string;following:boolean}){
 const {actorId,targetActorId,following}=input;
 if(!valid(actorId)||!valid(targetActorId)||actorId===targetActorId||typeof following!=='boolean')return {ok:false};
 const client=await clientFor(actorId);if(!client)return {ok:false};
 const query=client.from('follows');
 const {error}=following?await query.upsert({follower_actor_id:actorId,followed_actor_id:targetActorId},{onConflict:'follower_actor_id,followed_actor_id',ignoreDuplicates:true}):await query.delete().eq('follower_actor_id',actorId).eq('followed_actor_id',targetActorId);
 if(error)return {ok:false};
 revalidatePath('/following');return {ok:true};
}
export async function sendProfileConnectionRequest(input:{actorId:string;targetActorId:string}){
 const {actorId,targetActorId}=input;
 if(!valid(actorId)||!valid(targetActorId)||actorId===targetActorId)return {ok:false};
 const client=await clientFor(actorId);if(!client)return {ok:false};
 const [actor_a,actor_b]=[actorId,targetActorId].sort();
 const {error}=await client.from('connections').insert({actor_a,actor_b,requested_by:actorId,status:'pending'});
 return {ok:!error};
}
export async function answerProfileConnectionRequest(input:{actorId:string;actorA:string;actorB:string;status:'accepted'|'declined'}){
 const {actorId,actorA,actorB,status}=input;
 if(!valid(actorId)||!valid(actorA)||!valid(actorB)||actorA===actorB||![actorA,actorB].includes(actorId)||!['accepted','declined'].includes(status))return {ok:false};
 const client=await clientFor(actorId);if(!client)return {ok:false};
 const {data,error}=await client.from('connections').update({status,updated_at:new Date().toISOString()}).eq('actor_a',actorA).eq('actor_b',actorB).eq('status','pending').neq('requested_by',actorId).select('actor_a');
 return {ok:!error&&!!data?.length};
}
export async function removeProfileConnection(input:{actorId:string;targetActorId:string}){
 const {actorId,targetActorId}=input;
 if(!valid(actorId)||!valid(targetActorId)||actorId===targetActorId)return {ok:false};
 const client=await clientFor(actorId);if(!client)return {ok:false};
 const [actor_a,actor_b]=[actorId,targetActorId].sort();
 const {data,error}=await client.from('connections').delete().eq('actor_a',actor_a).eq('actor_b',actor_b).eq('status','accepted').select('actor_a');
 return {ok:!error&&!!data?.length};
}
