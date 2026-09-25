export type MeshCommunity = {id:string;city_id:string;name:string;location_text:string;description:string|null;population:number|null;people_connected:number|null;nodes:number|null;local_owners:number|null;is_verified:boolean;created_at:string};
export const communityTabs=['Overview','Members','Feed','Missions','Fundraising','Contributions','Proof','Impact'] as const;
export function metric(value:number|null) {return value===null?'Not reported':value.toLocaleString('en-US');}
