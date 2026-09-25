export const contributionTypes = [
 {value:'time',label:'Time'}, {value:'skills',label:'Skills'}, {value:'work',label:'Work'},
 {value:'money',label:'Money'}, {value:'equipment',label:'Equipment'}, {value:'services',label:'Services'},
 {value:'materials',label:'Materials'}, {value:'research',label:'Research'}, {value:'data',label:'Data'},
] as const;
export function contributionLabel(value:string) { return contributionTypes.find(type=>type.value===value)?.label??value; }
export type Contribution = {id:string;actor_id:string;contribution_type:string;title:string;description:string;contributed_on:string;created_at:string;mission_id:string|null;community_id:string|null;city_id:string|null;places:{name:string;source_key:string}|null;missions:{title:string}|null;mesh_communities:{name:string}|null};
