export type CityHashtagOption = {id:string;name:string;country:string;region:string;label:string};
export type CityHashtagOptions = Record<string, CityHashtagOption[]>;
export type CityHashtagRefs = Record<string,string>;

export function normalizeCityHashtag(value:string) {
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
}

export function extractCityHashtags(body:string) {
 return [...new Set([...body.matchAll(/(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,64})/gu)].map(match=>match[1].normalize('NFKC').toLowerCase()))].slice(0,10);
}
