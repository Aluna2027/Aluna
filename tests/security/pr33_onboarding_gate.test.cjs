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
const {isOnboardingComplete}=loadedModule.exports;
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

test('login, proxy, app layout, and onboarding route all fetch and apply the same gate fields',()=>{
 const files=['lib/supabase/proxy.ts','app/(auth)/login/actions.ts','app/(app)/layout.tsx','app/onboarding/page.tsx'];
 for(const file of files){
  const code=readFileSync(file,'utf8');
  assert.match(code,/isOnboardingComplete\(/,`${file} must enforce the shared onboarding gate`);
  assert.match(code,/demographics_required[\s\S]{0,80}date_of_birth[\s\S]{0,40}gender|date_of_birth[\s\S]{0,40}gender[\s\S]{0,80}demographics_required/,`${file} must fetch demographics requirement and values`);
 }
});
