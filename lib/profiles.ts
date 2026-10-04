export const userTabs = ['About','Posts','Connections','Followers','Following','Wi-Fi Mesh Communities','Missions','Fundraising','Donations','Contributions','Proofs','Impact'] as const;
export const organizationTabs = {
  university:['About','People','Posts','Connections','Wi-Fi Mesh Communities','Missions','Research','Fundraising','Funding','Contributions','Proofs','Impact'],
  ngo:['About','People','Posts','Connections','Wi-Fi Mesh Communities','Missions','Projects','Fundraising','Funding','Contributions','Proofs','Impact'],
  company:['About','People','Posts','Connections','Wi-Fi Mesh Communities','Missions','Partnerships','Sponsorship','Fundraising','Contributions','Proofs','Impact'],
} as const;
export type OrganizationType = keyof typeof organizationTabs;
export type PublicProfile = { id:string; display_name:string; bio:string|null; avatar_url:string|null; location_text:string|null; website:string|null; skills?:string[]; interests?:string[] };
export type Organization = { id:string; name:string; organization_type:OrganizationType; description:string|null; is_verified:boolean; logo_url:string|null; location_text:string|null; website:string|null; wba_total_score?:number|null; wba_human_rights_score?:number|null; wba_decent_work_score?:number|null; wba_acting_ethically_score?:number|null };
export function tabSlug(label:string) {return label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export function safeUrl(value:string|null|undefined) {if(!value)return null;try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.toString():null;} catch {return null;}}
