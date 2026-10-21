// PR33: isolated coverage of the existing DNS TXT verification server action.
// Executes transpiled source with mocked DNS, Supabase and Next.js. No network,
// live domain, credentials, Auth accounts or database writes.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node:test runner */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source=readFileSync('app/(app)/aluna-admin/verified-domains/actions.ts','utf8');
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const org='22222222-2222-4222-8222-222222222221';
const admin='11111111-1111-4111-8111-111111111111';
const id='33333333-3333-4333-8333-333333333333';
const domain='aluna-qa.invalid';
const token='a'.repeat(64);
const hash=(value)=>createHash('sha256').update(value).digest('hex');
const route='/aluna-admin/verified-domains';

function setup(options={}) {
 const challenge={
  id,domain,organization_id:org,challenge_hash:hash(token),
  verified_at:null,expires_at:new Date(Date.now()+86400000).toISOString(),
  ...options.challenge
 };
 const trace={dns:[],rpc:[],revalidated:[],queries:0,auth:0};
 const db={
  from(table){
   trace.queries++;
   if(table==='organization_domain_challenges')return{
    select:()=>({eq:()=>({maybeSingle:async()=>({
     data:options.challengeMissing?null:challenge,error:options.challengeError?{message:'failed'}:null
    })})})
   };
   if(table==='organizations')return{
    select:()=>({eq:()=>({is:()=>({maybeSingle:async()=>({
     data:options.organizationMissing?null:{id:org},error:null
    })})})})
   };
   if(table==='organization_verified_domains')return{
    select:()=>({eq:()=>({limit:async()=>({
     data:options.alreadyRegistered?[{organization_id:org}]:[],error:null
    })})})
   };
   throw Error('Unexpected query on '+table);
  },
  rpc:async(name,args)=>{
   trace.rpc.push({name,args});
   if(name!=='aluna_audited_verify_domain')throw Error('Unexpected RPC');
   return {data:options.rpcWrongResult?'other.invalid':domain,
           error:options.rpcError?{message:'atomic failure'}:null};
  }
 };
 const redir=(url)=>{const error=Error('Redirect');error.destination=url;throw error};
 const required={
  'next/navigation':{redirect:redir},
  'next/cache':{revalidatePath:(url)=>{trace.revalidated.push(url)}},
  'node:dns/promises':{resolveTxt:async(host)=>{
   trace.dns.push(host);
   if(options.dnsError)throw Error('ENOTFOUND');
   return options.records??[['aluna-verify='+token]];
  }},
  'next/headers':{cookies:async()=>({set:()=>{throw Error('Unexpected cookie write')}})},
  '@/lib/aluna-admin':{requireAlunaSuperAdmin:async()=>{
   trace.auth++;
   if(options.unauthorized)throw Error('unauthorized');
   return {user:{id:admin},db};
  }},
  '@/lib/org-access':{newToken:()=>token,tokenHash:hash}
 };
 const testModule={exports:{}};
 vm.runInNewContext(compiled,{
  module:testModule,exports:testModule.exports,
  require:(name)=>{if(!Object.hasOwn(required,name))throw Error('Unexpected import '+name);return required[name]},
  Date,console
 },{filename:'pr33_domain_server_action.js',timeout:1000});
 const run=(fields={})=>testModule.exports.verifyOrganizationDomain({
  get:(name)=>({challenge_id:id,token,...fields})[name]??null
 });
 return {trace,run};
}
async function rejectTo(action,path) {
 await assert.rejects(action,(e)=>{assert.equal(e.destination,route+path);return true});
}
test('matching real-format TXT, including split DNS strings, authorizes one audited RPC',async()=>{
 const h=setup({records:[['irrelevant=record'],['aluna-verify=',token.slice(0,15),token.slice(15)]]});
 await rejectTo(()=>h.run(),'?status=verified');
 assert.deepEqual(h.trace.dns,['_aluna-verify.'+domain]);
 assert.equal(h.trace.rpc.length,1);
 assert.equal(h.trace.rpc[0].name,'aluna_audited_verify_domain');
 assert.equal(h.trace.rpc[0].args.p_challenge,id);
 assert.equal(h.trace.rpc[0].args.p_actor,admin);
 assert.deepEqual(h.trace.revalidated,[route]);
});
test('missing or incorrect DNS token never invokes the audited verification RPC',async()=>{
 for(const records of [[],[['aluna-verify='+('b'.repeat(64))]],[['prefix=aluna-verify='+token]]]){
  const h=setup({records});
  await rejectTo(()=>h.run(),'?error=dns');
  assert.equal(h.trace.rpc.length,0);
 }
});
test('DNS lookup errors are fail-closed',async()=>{
 const h=setup({dnsError:true});
 await rejectTo(()=>h.run(),'?error=dns');
 assert.equal(h.trace.rpc.length,0);
});
test('expired, replayed and wrong-hash challenges are denied before DNS',async()=>{
 for(const challenge of [
  {expires_at:'2000-01-01T00:00:00.000Z'},
  {verified_at:'2026-10-01T00:00:00.000Z'},
  {challenge_hash:hash('b'.repeat(64))}
 ]){
  const h=setup({challenge});
  await rejectTo(()=>h.run(),'?error=challenge');
  assert.equal(h.trace.dns.length,0);
  assert.equal(h.trace.rpc.length,0);
 }
});
test('missing or removed organization denies verification before DNS',async()=>{
 const h=setup({organizationMissing:true});
 await rejectTo(()=>h.run(),'?error=organization');
 assert.equal(h.trace.dns.length,0);
 assert.equal(h.trace.rpc.length,0);
});
test('already verified domain and atomic RPC failure cannot report success',async()=>{
 const duplicate=setup({alreadyRegistered:true});
 await rejectTo(()=>duplicate.run(),'?error=already-registered');
 assert.equal(duplicate.trace.rpc.length,0);
 const dbError=setup({rpcError:true});
 await rejectTo(()=>dbError.run(),'?error=save');
 assert.equal(dbError.trace.rpc.length,1);
 assert.deepEqual(dbError.trace.revalidated,[]);
 const wrong=setup({rpcWrongResult:true});
 await rejectTo(()=>wrong.run(),'?error=save');
 assert.deepEqual(wrong.trace.revalidated,[]);
});
test('invalid challenge ID or token rejected before privileged client is accessed',async()=>{
 for(const fields of [{challenge_id:'not-an-id'},{token:'too-short'},{token:'g'.repeat(64)}]){
  const h=setup();
  await rejectTo(()=>h.run(fields),'?error=validation');
  assert.equal(h.trace.auth,0);
  assert.equal(h.trace.dns.length,0);
  assert.equal(h.trace.rpc.length,0);
 }
});
test('unauthorized request never queries database or DNS',async()=>{
 const h=setup({unauthorized:true});
 await assert.rejects(()=>h.run(),/unauthorized/);
 assert.equal(h.trace.queries,0);
 assert.equal(h.trace.dns.length,0);
 assert.equal(h.trace.rpc.length,0);
});
