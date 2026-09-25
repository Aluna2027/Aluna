import { createClient } from '@/lib/supabase/server';

export type ImpactScope={actorId?:string;missionId?:string;communityId?:string;cityKey?:string};
export type ImpactMetrics={peopleConnected:number;nodesInstalled:number;localOwners:number;missionsCompleted:number;moneyRaised:number;moneyInvested:number;volunteerHours:number;skillsContributed:number;organizationsInvolved:number;sdgMetrics:number;communityData:number;verifiedResults:number;reportedResults:number;timeline:Array<{date:string;label:string;level:number}>};

export async function getImpactMetrics(scope:ImpactScope={}):Promise<ImpactMetrics>{
 const client=await createClient(); let cityId:string|undefined;
 if(scope.cityKey){const {data}=await client.from('places').select('id').eq('source_key',scope.cityKey).maybeSingle();cityId=data?.id;if(!cityId)return emptyImpactMetrics();}
 let missionsQuery=client.from('missions').select('id,created_by_actor_id,community_id,city_id,budget_amount,ends_on').limit(1000);
 if(scope.missionId)missionsQuery=missionsQuery.eq('id',scope.missionId);
 if(scope.communityId)missionsQuery=missionsQuery.eq('community_id',scope.communityId);
 if(cityId)missionsQuery=missionsQuery.eq('city_id',cityId);
 const [{data:missions},{data:communities},{data:contributions},{data:proofs},{data:raised}]=await Promise.all([
  missionsQuery,
  (()=>{let q=client.from('mesh_communities').select('id,people_connected,nodes,local_owners,city_id').limit(1000);if(scope.communityId)q=q.eq('id',scope.communityId);if(cityId)q=q.eq('city_id',cityId);return q;})(),
  (()=>{let q=client.from('contributions').select('id,actor_id,mission_id,community_id,city_id,contribution_type,quantity,quantity_unit,created_at,contributed_on').limit(2000);if(scope.actorId)q=q.eq('actor_id',scope.actorId);if(scope.missionId)q=q.eq('mission_id',scope.missionId);if(scope.communityId)q=q.eq('community_id',scope.communityId);if(cityId)q=q.eq('city_id',cityId);return q;})(),
  (()=>{let q=client.from('proofs').select('id,actor_id,mission_id,city_id,contribution_id,verification_level,occurred_on,created_at').limit(2000);if(scope.actorId)q=q.eq('actor_id',scope.actorId);if(scope.missionId)q=q.eq('mission_id',scope.missionId);if(cityId)q=q.eq('city_id',cityId);return q;})(),
  client.rpc('impact_money_raised',{p_actor:scope.actorId??null,p_mission:scope.missionId??null,p_community:scope.communityId??null,p_city:cityId??null}),
 ]);
 const ms=missions??[], cons=contributions??[];
 const missionIds=new Set(ms.map(m=>m.id));
 const scopedCommunities=scope.missionId?new Set(ms.map(m=>m.community_id).filter(Boolean)):null;
 const cs=(communities??[]).filter(c=>!scopedCommunities||scopedCommunities.has(c.id));
 const ps=(proofs??[]).filter(p=>!scope.communityId||cons.some(c=>c.id===p.contribution_id)||missionIds.has(p.mission_id));
 const timeline=ps.map(p=>({date:p.occurred_on,label:`Proof recorded · L${p.verification_level}`,level:p.verification_level})).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
 return {peopleConnected:scope.actorId?0:cs.reduce((n,c)=>n+(c.people_connected??0),0),nodesInstalled:scope.actorId?0:cs.reduce((n,c)=>n+(c.nodes??0),0),localOwners:scope.actorId?0:cs.reduce((n,c)=>n+(c.local_owners??0),0),missionsCompleted:0,moneyRaised:Number(raised??0),moneyInvested:0,volunteerHours:cons.filter(c=>c.contribution_type==='time'&&c.quantity_unit==='hours').reduce((n,c)=>n+Number(c.quantity??0),0),skillsContributed:cons.filter(c=>c.contribution_type==='skills').length,organizationsInvolved:0,sdgMetrics:0,communityData:scope.actorId?0:cs.length,verifiedResults:ps.filter(p=>p.verification_level>=3).length,reportedResults:cons.length+ps.length,timeline};
}

function emptyImpactMetrics():ImpactMetrics{return {peopleConnected:0,nodesInstalled:0,localOwners:0,missionsCompleted:0,moneyRaised:0,moneyInvested:0,volunteerHours:0,skillsContributed:0,organizationsInvolved:0,sdgMetrics:0,communityData:0,verifiedResults:0,reportedResults:0,timeline:[]};}
