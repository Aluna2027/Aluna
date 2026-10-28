export type Mission={id:string;city_id:string|null;manual_place:string|null;manual_country:string|null;community_id:string|null;created_by_actor_id:string;title:string;overview:string;location_text:string;goal:string;roles_summary:string|null;starts_on:string|null;ends_on:string|null;budget_amount:number|null;funding_goal_amount:number|null;currency_code:string;created_at:string};
export const missionTabs=['Overview','Participate','Communication','Fundraising','Impact'] as const;
// Old section URLs remain readable after tabs are consolidated.
const missionTabAliases:Record<string,(typeof missionTabs)[number]>={
 location:'Overview',goal:'Overview',timeline:'Overview',
 team:'Participate',roles:'Participate',participants:'Participate',contributions:'Participate',
 posts:'Communication',comments:'Communication',messages:'Communication',
 budget:'Fundraising','funding-goal':'Fundraising',donate:'Fundraising',
 proofs:'Impact',verification:'Impact'
};
export function missionTabFromSlug(slug?:string):(typeof missionTabs)[number] {
 return missionTabs.find(tab=>tab.toLowerCase()===slug)??missionTabAliases[slug??'']??'Overview';
}
export const participationOptions=[{value:'join_team',label:'Join Team'},{value:'volunteer',label:'Volunteer'},{value:'contribute_skills',label:'Contribute Skills'},{value:'contribute_time',label:'Contribute Time'},{value:'provide_expertise',label:'Provide Expertise'},{value:'provide_resources',label:'Provide Resources'},{value:'fundraising',label:'Fundraising'}] as const;
export function money(value:number|null,currency:string){return value===null?'Not reported':new Intl.NumberFormat('en',{style:'currency',currency,maximumFractionDigits:2}).format(value);}
