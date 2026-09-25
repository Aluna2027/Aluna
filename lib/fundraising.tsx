import { money } from '@/lib/missions';
export type Campaign={id:string;mission_id:string;actor_id:string;title:string;story:string;goal_amount:number;currency_code:string;created_at:string};
export type Fundraiser={id:string;campaign_id:string;mission_id:string;actor_id:string;kind:'personal'|'team';slug:string;title:string;story:string;goal_amount:number;created_at:string};
export type Total={fundraiser_id:string|null;amount_raised:number;donor_count:number};
export function progress(amount:number,goal:number){return goal>0?Math.min(100,Math.max(0,Math.round(amount/goal*100))):0;}
export function Progress({amount,goal,currency,count}:{amount:number;goal:number;currency:string;count:number}){
 const percent=progress(amount,goal);return <div><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><strong className="text-ink">{money(amount,currency)} raised</strong><span>of {money(goal,currency)} · {count} donor{count===1?'':'s'}</span></div><div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Fundraising progress" className="h-3 overflow-hidden rounded-full bg-panel-raised"><div className="h-full rounded-full bg-gold" style={{width:`${percent}%`}}/></div></div>;
}
export function campaignTotal(totals:Total[]){const overall=totals.find(t=>t.fundraiser_id===null);return {amount:Number(overall?.amount_raised??0),count:Number(overall?.donor_count??0)};}
