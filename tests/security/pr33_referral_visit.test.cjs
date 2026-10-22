// Isolated tests for server-derived referral visitor identity and RPC routing.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node:test runner */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const ts=require('typescript');
const {URL}=require('node:url');

function load(file,mocks={}){
 const source=readFileSync(file,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loadedModule={exports:{}};
 const mockedRequire=(id)=>Object.prototype.hasOwnProperty.call(mocks,id)?mocks[id]:require(id);
 new Function('module','exports','require',compiled)(loadedModule,loadedModule.exports,mockedRequire);
 return loadedModule.exports;
}

process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-server-secret';
const {referralVisitorHash}=load('lib/referral-visit.ts',{'server-only':{}});
const request=(ip)=>({headers:new Headers({'x-real-ip':ip})});

test('referral visitor identity is a one-way server HMAC and stable for a daily IP',()=>{
 const first=referralVisitorHash(request('203.0.113.10'));
 assert.match(first,/^[a-f0-9]{64}$/);
 assert.equal(first,referralVisitorHash(request('203.0.113.10')));
 assert.notEqual(first,referralVisitorHash(request('203.0.113.11')));
 assert.equal(first.includes('203.0.113.10'),false);
});

class MockResponse{
 constructor(body,options={}){this.body=body;this.status=options.status??200;this.cookies={set:(...args)=>{this.cookie=args;}};this.headers=new Headers();}
 static redirect(url){const r=new MockResponse(null,{status:307});r.location=String(url);return r;}
}

function routeTest(path,target){
 const calls=[];
 const route=load(path,{
  'next/server':{NextResponse:MockResponse},
  '@/lib/org-access':{adminDb:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:target,error:null};}})},
  '@/lib/referrals':{isReferralSource:value=>['direct','whatsapp','facebook','instagram','linkedin','x','tiktok','telegram','email','qr','copy'].includes(value)},
  '@/lib/referral-visit':{referralVisitorHash}
 });
 const req={nextUrl:new URL('https://aluna.example/ref?source=whatsapp'),url:'https://aluna.example/ref?source=whatsapp',headers:new Headers({'x-real-ip':'203.0.113.20'})};
 return route.GET(req,{params:Promise.resolve({token:'a'.repeat(32)})}).then(response=>({calls,response}));
}

test('public campaign referral uses the server-only RPC with hashed visitor identity',async()=>{
 const {calls,response}=await routeTest('app/cr/[token]/route.ts','campaign-id');
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'visit_campaign_referral');
 assert.equal(calls[0].args.p_source,'whatsapp');
 assert.match(calls[0].args.p_visitor_hash,/^[a-f0-9]{64}$/);
 assert.match(response.location,/\/c\/campaign-id/);
});

test('public fundraiser referral uses the server-only RPC with hashed visitor identity',async()=>{
 const {calls,response}=await routeTest('app/r/[token]/route.ts','fundraiser-slug');
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'visit_fundraiser_referral');
 assert.equal(calls[0].args.p_source,'whatsapp');
 assert.match(calls[0].args.p_visitor_hash,/^[a-f0-9]{64}$/);
 assert.match(response.location,/\/f\/fundraiser-slug/);
});
