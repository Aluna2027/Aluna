// Isolated unit coverage for legacy and current onboarding gate behavior.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node:test runner */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const ts=require('typescript');

const source=readFileSync('lib/onboarding.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loadedModule={exports:{}};
new Function('module','exports','require',compiled)(loadedModule,loadedModule.exports,require);
const {isOnboardingComplete,readOnboardingProfile}=loadedModule.exports;
const core={display_name:'Member',first_name:'A',last_name:'User',aluna_role:'builder',onboarded_at:'2026-01-01T00:00:00Z'};

test('legacy profiles remain complete when demographics were not required',()=>{
 assert.equal(isOnboardingComplete(core),true);
 assert.equal(isOnboardingComplete({...core,demographics_required:false}),true);
});

test('new profiles cannot pass the gate without valid date of birth and gender',()=>{
 assert.equal(isOnboardingComplete({...core,demographics_required:true}),false);
 assert.equal(isOnboardingComplete({...core,demographics_required:true,date_of_birth:'2000-01-01',gender:'unknown'}),false);
 assert.equal(isOnboardingComplete({...core,demographics_required:true,date_of_birth:'2000-01-01',gender:'prefer_not_to_say'}),true);
});

test('login, proxy, app layout, and onboarding route all use the shared profile reader and gate',()=>{
 const files=['lib/supabase/proxy.ts','app/(auth)/login/actions.ts','app/(app)/layout.tsx','app/onboarding/page.tsx'];
 for(const file of files){
  const code=readFileSync(file,'utf8');
  assert.match(code,/readOnboardingProfile\(/,`${file} must use the schema-compatible profile reader`);
  assert.match(code,/isOnboardingComplete\(/,`${file} must enforce the shared onboarding gate`);
 }
});

test('profile reader retries only when the rollout flag column is missing',async()=>{
 const selections=[];
 const profile={id:'user-1',display_name:'Member',first_name:'A',last_name:'User',aluna_role:'builder',onboarded_at:'2026-01-01',date_of_birth:null,gender:null};
 const client={from(table){assert.equal(table,'profiles');return{select(fields){selections.push(fields);return{eq(column,value){assert.equal(column,'id');assert.equal(value,'user-1');return{maybeSingle:async()=>selections.length===1?{data:null,error:{message:'column profiles.demographics_required does not exist'}}:{data:profile,error:null}}}}}}}};
 const result=await readOnboardingProfile(client,'user-1');
 assert.equal(selections.length,2);
 assert.match(selections[0],/demographics_required/);
 assert.doesNotMatch(selections[1],/demographics_required/);
 assert.equal(result.data.demographics_required,false);
 assert.equal(result.data.date_of_birth,null);
 assert.equal(result.data.gender,null);
});

test('profile reader does not hide unrelated database errors',async()=>{
 let calls=0;
 const client={from(){return{select(){return{eq(){return{maybeSingle:async()=>{calls++;return{data:null,error:{message:'permission denied'}}}}}}}}}};
 const result=await readOnboardingProfile(client,'user-1');
 assert.equal(calls,1);
 assert.equal(result.error.message,'permission denied');
});


const profileSource=readFileSync('lib/profiles.ts','utf8');
const profileCompiled=ts.transpileModule(profileSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const profileModule={exports:{}};
new Function('module','exports','require',profileCompiled)(profileModule,profileModule.exports,require);
const {isMissingPublicProfilesView}=profileModule.exports;

test('profile search falls back only when the public profile view is absent',()=>{
 assert.equal(isMissingPublicProfilesView(`Could not find the table 'public.public_profiles' in the schema cache`),true);
 assert.equal(isMissingPublicProfilesView('relation "public.public_profiles" does not exist'),true);
 assert.equal(isMissingPublicProfilesView('permission denied for table profiles'),false);
 const search=readFileSync('app/(app)/search/page.tsx','utf8');
 assert.match(search,/isMissingPublicProfilesView\(viewResult\.error\.message\)/);
 assert.match(search,/from\('profiles'\)\.select\('id,display_name,bio'\)/);
 const selectedColumns=[...search.matchAll(/\.select\('([^']+)'\)/g)].map(match=>match[1]);
 assert.ok(selectedColumns.includes('id,display_name,bio'));
 assert.ok(selectedColumns.every(columns=>!/(?:^|,)(?:date_of_birth|gender)(?:,|$)/.test(columns)));
});
