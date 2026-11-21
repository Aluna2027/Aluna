import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function route({people=[],orgs=[],signedIn=true}={}){
 let requests=0;
 const ids=new Map([...people.map(p=>[p.id,{id:p.id,profile_id:p.id}]),...orgs.map(p=>[p.id,{id:p.id,organization_id:p.id}])]);
 const client={auth:{getUser:async()=>({data:{user:signedIn?{id:'viewer'}:null}})},from(table){requests++;let rows=table==='public_profiles'?people:table==='organizations'?orgs:[...ids.values()];let max=Infinity;const b={select(){return b},is(){return b},ilike(key,q){rows=rows.filter(r=>r[key].toLowerCase().startsWith(q.slice(0,-1).toLowerCase()));return b},order(){rows=[...rows].sort((a,b)=>a.id.localeCompare(b.id));return b},limit(n){max=n;return b},gt(key,id){rows=rows.filter(r=>r[key]>id);return b},in(key,values){rows=rows.filter(r=>values.includes(r[key]));return b},then(resolve,reject){return Promise.resolve({data:rows.slice(0,max),error:null}).then(resolve,reject)}};return b;}};
 const code=ts.transpileModule(fs.readFileSync('app/api/mentions/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,Buffer,require(name){if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,...options})}};if(name==='@/lib/supabase/server')return {createClient:async()=>client};throw new Error(name);}});
 return {get:async(q,cursor)=>exports.GET({nextUrl:new URL('https://example.test/api/mentions?q='+encodeURIComponent(q)+(cursor?'&cursor='+encodeURIComponent(cursor):''))}),requests:()=>requests};
}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('incremental people and organizations exhaust all batches without duplicates',async()=>{
 const people=Array.from({length:31},(_,i)=>({id:id(i+1),display_name:'Frank '+i,avatar_url:null}));const orgs=Array.from({length:18},(_,i)=>({id:id(i+100),name:'Frank Org '+i,logo_url:null}));const r=route({people,orgs});let cursor;const found=[];let pages=0;
 do{const res=await r.get('frank',cursor);found.push(...res.body.results);cursor=res.body.nextCursor;assert.ok(++pages<8);}while(cursor);
 assert.equal(found.length,49);assert.equal(new Set(found.map(p=>p.id)).size,49);assert.equal(pages,3);assert.equal(found.filter(p=>p.kind==='organization').length,18);
});
test('unauthenticated and wildcard-only queries do not scan profiles',async()=>{const unauth=route({signedIn:false});assert.equal((await unauth.get('frank')).status,401);assert.equal(unauth.requests(),0);const empty=route();assert.equal((await empty.get('%_\\')).body.results.length,0);assert.equal(empty.requests(),0);});
test('invalid pagination cursor is rejected before directory queries',async()=>{const r=route();const bad=Buffer.from(JSON.stringify({people:'x),id.gt.0'})).toString('base64url');assert.equal((await r.get('frank',bad)).status,400);assert.equal(r.requests(),0);});
