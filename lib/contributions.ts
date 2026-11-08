export const contributionTypes = [
 {value:'data',label:'Data'}, {value:'time',label:'Time'}, {value:'skills',label:'Skills'},
 {value:'work',label:'Work'}, {value:'money',label:'Money'}, {value:'equipment',label:'Equipment'},
 {value:'services',label:'Services'}, {value:'materials',label:'Materials'}, {value:'research',label:'Research'},
 {value:'complete_sdg_mission',label:'Complete SDG Mission'}, {value:'complete_wifi_community',label:'Complete Wi-Fi Mesh Community'}
] as const;
export function contributionLabel(value:string) {return contributionTypes.find(t=>t.value===value)?.label??value;}
export type Contribution={id:string;actor_id:string;contribution_type:string;title:string;description:string;contributed_on:string;created_at:string;details?:Record<string,string>|null;mission_id:string|null;community_id:string|null;city_id:string|null;places:{name:string;source_key:string}|null;missions:{title:string}|null;mesh_communities:{name:string}|null};
export const resultKeys=[
 {key:'people_connected',label:'People Connected',unit:'people'},
 {key:'nodes_installed',label:'Wi-Fi Nodes Installed',unit:'nodes'},
 {key:'local_owners',label:'Local Owners',unit:'women'},
 {key:'money_invested',label:'Money Invested',unit:'EUR'},
 {key:'sdg_metrics',label:'SDG Metrics',unit:'measurements'},
 {key:'community_data',label:'Community Data',unit:'datasets'}
] as const;
