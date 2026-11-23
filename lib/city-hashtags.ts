export type CityHashtagOption = {id:string;name:string;country:string;region:string;label:string};
export type CityHashtagOptions = Record<string, CityHashtagOption[]>;
export type CityHashtagRefs = Record<string,string>;
export type CityCandidate = {id:string;name:string;country:string;region:string};

export function normalizeCityHashtag(value:string) {
 return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');
}

/** Return every exact normalized candidate; callers must retain each stable city ID. */
export function matchCityHashtagCandidates(tag:string,candidates:CityCandidate[]) {
 const key=normalizeCityHashtag(tag);
 if(!key)return [];
 return candidates.filter(city=>normalizeCityHashtag(city.name)===key);
}

export function extractCityHashtags(body:string) {
 return [...new Set([...body.matchAll(/(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,64})/gu)].map(match=>match[1].normalize('NFKC').toLowerCase()))].slice(0,10);
}
