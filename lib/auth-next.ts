const safeDestination=/^\/(?:f\/[a-z0-9-]{1,100}|c\/[0-9a-f-]{36}|cities\/[a-z0-9-]+|world-map|feed|following|missions(?:\/[0-9a-f-]{36})?|organizations\/invite\/[0-9a-f]{64}|organizations|aluna-admin|communities|fundraising|proofs|impact|search)(?:\?[^#]*)?$/i;

export function safeAuthDestination(value:string){return safeDestination.test(value)?value:'/feed';}
