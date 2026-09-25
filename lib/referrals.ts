export const referralSources=['direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy'] as const;
export type ReferralSource=typeof referralSources[number];
export type ReferralRow={source:ReferralSource;clicks:number;donations_attributed:number;amount_raised:number;new_fundraisers:number};
export function isReferralSource(value:string):value is ReferralSource{return referralSources.some(source=>source===value);}
export function conversion(donations:number,clicks:number){return clicks>0?`${(donations/clicks*100).toFixed(1)}%`:'0%';}
