export function unreadLabel(count:number):string|null{return Number.isFinite(count)&&count>0?(count>99?'99+':String(Math.floor(count))):null;}
export function mergeComments<T extends {id:string;created_at:string}>(current:T[],incoming:T[]):T[]{
 const rows=new Map(current.map(row=>[row.id,row]));for(const row of incoming)rows.set(row.id,row);
 return [...rows.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
