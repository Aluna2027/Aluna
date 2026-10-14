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

export const sdgColors:Record<number,string>={1:'#E5243B',2:'#DDA63A',3:'#4C9F38',4:'#C5192D',5:'#FF3A21',6:'#26BDE2',7:'#FCC30B',8:'#A21942',9:'#FD6925',10:'#DD1367',11:'#FD9D24',12:'#BF8B2E',13:'#3F7E44',14:'#0A97D9',15:'#56C02B',16:'#00689D',17:'#19486A'};
