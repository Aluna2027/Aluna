export const first340Statuses=[['draft','Draft'],['submitted','Submitted'],['under_review','Under Review'],['candidate','Candidate'],['waitlisted','Waitlisted'],['selected','Selected'],['not_selected','Not Selected'],['withdrawn','Withdrawn']] as const;
export type First340Status=typeof first340Statuses[number][0];
export function first340StatusLabel(value:string){return first340Statuses.find(s=>s[0]===value)?.[1]??value;}
