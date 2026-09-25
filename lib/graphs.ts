import { createClient } from '@/lib/supabase/server';

export type SocialGraphEdge={source_actor_id:string;relation:string;target_actor_id:string;status:string;created_at:string};
export type ImpactGraphEdge={source_type:string;source_id:string;relation:string;target_type:string;target_id:string|null;metadata:Record<string,unknown>;occurred_at:string};

export async function getSocialGraph(actorId:string){const client=await createClient();const {data,error}=await client.rpc('social_graph_edges',{p_actor:actorId});if(error)throw error;return (data??[]) as SocialGraphEdge[];}
export async function getImpactGraph(scope:{actorId?:string;missionId?:string;communityId?:string;cityId?:string}={}){const client=await createClient();const {data,error}=await client.rpc('impact_graph_edges_for',{p_actor:scope.actorId??null,p_mission:scope.missionId??null,p_community:scope.communityId??null,p_city:scope.cityId??null});if(error)throw error;return (data??[]) as ImpactGraphEdge[];}
