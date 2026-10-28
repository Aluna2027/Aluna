import type { createClient } from '@/lib/supabase/server';

type Client=Awaited<ReturnType<typeof createClient>>;

/**
 * A mission creator remains its owner even without a participation row.
 * Other actors cannot leave an active campaign without first ending it.
 * Throw on lookup errors: a failed permission check must never silently allow leaving.
 */
export async function activeCampaignExitGuard(client:Client,missionId:string,actorId:string){
 const {data:mission,error:missionError}=await client.from('missions')
  .select('created_by_actor_id').eq('id',missionId).is('removed_at',null).maybeSingle();
 if(missionError||!mission)throw new Error('Unable to verify mission ownership');
 if(mission.created_by_actor_id===actorId)return {creator:true,blocked:false};
 const {data,error}=await client.from('fundraising_campaigns')
  .select('id,title').eq('mission_id',missionId).eq('actor_id',actorId)
  .is('archived_at',null).is('removed_at',null).limit(1);
 if(error)throw new Error('Unable to verify active fundraising campaigns');
 return {creator:false,blocked:Boolean(data?.length)};
}
