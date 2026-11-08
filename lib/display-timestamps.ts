export function createdOrEdited(createdAt:string|null|undefined,updatedAt:string|null|undefined){
 if(!createdAt)return '';
 const created=new Date(createdAt);const edited=updatedAt?new Date(updatedAt):null;
 const modified=Boolean(edited&&Number.isFinite(+edited)&&(+edited-+created)>1000);
 const stamp=modified?edited!:created;
 return (modified?'Edited on: ':'Created on: ')+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(stamp);
}
