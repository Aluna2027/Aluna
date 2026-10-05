export const sdgs=[
 {number:1,title:'No Poverty'},
 {number:2,title:'Zero Hunger'},
 {number:3,title:'Good Health and Well-being'},
 {number:4,title:'Quality Education'},
 {number:5,title:'Gender Equality'},
 {number:6,title:'Clean Water and Sanitation'},
 {number:7,title:'Affordable and Clean Energy'},
 {number:8,title:'Decent Work and Economic Growth'},
 {number:9,title:'Industry, Innovation and Infrastructure'},
 {number:10,title:'Reduced Inequalities'},
 {number:11,title:'Sustainable Cities and Communities'},
 {number:12,title:'Responsible Consumption and Production'},
 {number:13,title:'Climate Action'},
 {number:14,title:'Life Below Water'},
 {number:15,title:'Life on Land'},
 {number:16,title:'Peace, Justice and Strong Institutions'},
 {number:17,title:'Partnerships for the Goals'},
] as const;

export function sdgLabel(number:number){
 const item=sdgs.find(s=>s.number===number);
 return item?'SDG '+item.number+': '+item.title:'SDG '+number;
}
