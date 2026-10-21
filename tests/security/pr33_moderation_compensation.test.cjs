// PR33: deliberately isolated unit tests for the EXISTING moderation server action.
// Source is transpiled (not rewritten); all Supabase, Next.js and Auth calls are mocked.
// No keys, network, browser, real identities, database connections, or live writes.
/* eslint-disable @typescript-eslint/no-require-imports -- This is a Node.js CommonJS test runner. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('app/(app)/aluna-admin/users/actions.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}
}).outputText;
const admin = '11111111-1111-4111-8111-111111111111';
const member = '11111111-1111-4111-8111-111111111112';
const destination = '/aluna-admin/users';
const reason = 'Isolated audit compensation regression test';

function harness(options={}) {
  const state = {bannedUntil:options.bannedUntil??null, updates:[], audits:[], revalidated:[], lookups:[]};
  const db = {
    from(table) {
      if(table==='aluna_super_admins') return {
        select:()=>({eq:()=>({maybeSingle:async()=>({
          data:options.protectedUser?{profile_id:member}:null,error:null
        })})})
      };
      if(table==='aluna_profile_moderation_audit') return {
        insert:async(row)=>{
          state.audits.push(row);
          return {error:options.auditFailure?{code:'AUDIT_DENIED'}:null};
        }
      };
      throw Error('Unexpected table '+table);
    },
    auth: {admin: {
      getUserById:async(id)=>{
        state.lookups.push(id);
        return {data:{user:{id,banned_until:state.bannedUntil}},error:null};
      },
      updateUserById:async(id, {ban_duration})=>{
        assert.equal(id,member);
        state.updates.push(ban_duration);
        if(options.restoreFailure && state.updates.length===2) return {error:{code:'RESTORE_DENIED'}};
        if(ban_duration==='none') state.bannedUntil=null;
        else if(ban_duration==='876000h') state.bannedUntil=new Date(Date.now()+876000*3600000).toISOString();
        else if(/^\d+s$/.test(ban_duration)) state.bannedUntil=new Date(Date.now()+parseInt(ban_duration,10)*1000).toISOString();
        else throw Error('Unexpected ban duration '+ban_duration);
        return {error:null};
      }
    }}
  };
  const redirects=[];
  const testModule={exports:{}};
  const required={
    'next/navigation':{redirect:(url)=>{
      redirects.push(url);
      const error=Error('Mock redirect to '+url);
      error.destination=url;
      throw error;
    }},
    'next/cache':{revalidatePath:(path)=>{state.revalidated.push(path)}},
    '@/lib/aluna-admin':{requireAlunaSuperAdmin:async()=>{
      if(options.unauthorized) throw Error('unauthorized');
      return {user:{id:admin},db};
    }}
  };
  vm.runInNewContext(compiled,{
    module:testModule,exports:testModule.exports,require:(name)=>{
      if(!Object.hasOwn(required,name))throw Error('Unexpected import '+name);
      return required[name];
    },console
  },{filename:'pr33_moderation_action.js',timeout:1000});
  const send=(decision,id=member)=>testModule.exports.moderateAlunaUser({
    get:(name)=>({profile_id:id,decision,reason})[name]??null
  });
  return {state,redirects,send};
}
async function expectRedirect(action,url) {
  await assert.rejects(action,err=>{
    assert.equal(err.destination,url);
    return true;
  });
}

test('successful suspension writes audit and does not compensate',async()=>{
  const h=harness();
  await expectRedirect(()=>h.send('suspended'),destination+'?status=suspended');
  assert.deepEqual(h.state.updates,['876000h']);
  assert.ok(new Date(h.state.bannedUntil)>new Date());
  assert.equal(h.state.audits.length,1);
  assert.deepEqual(h.state.revalidated,[destination]);
});

test('failed audit after suspension restores the previous unbanned state',async()=>{
  const h=harness({auditFailure:true});
  await expectRedirect(()=>h.send('suspended'),destination+'?error=audit-restored');
  assert.deepEqual(h.state.updates,['876000h','none']);
  assert.equal(h.state.bannedUntil,null);
  assert.deepEqual(h.state.revalidated,[]);
});

test('failed audit after reactivation restores the previous suspension',async()=>{
  const original=new Date(Date.now()+95*1000).toISOString();
  const h=harness({bannedUntil:original,auditFailure:true});
  await expectRedirect(()=>h.send('reactivated'),destination+'?error=audit-restored');
  assert.equal(h.state.updates[0],'none');
  assert.match(h.state.updates[1],/^\d+s$/);
  assert.ok(Math.abs(Date.parse(h.state.bannedUntil)-Date.parse(original))<=3000);
});

test('failed audit and failed restoration raises an explicit escalation error',async()=>{
  const h=harness({auditFailure:true,restoreFailure:true});
  await expectRedirect(()=>h.send('suspended'),destination+'?error=audit-restore-failed');
  assert.deepEqual(h.state.updates,['876000h','none']);
  assert.ok(new Date(h.state.bannedUntil)>new Date());
});

test('no moderation update is possible for self or a protected Super Admin',async()=>{
  for(const [options,target] of [[{},admin],[{protectedUser:true},member]]) {
    const h=harness(options);
    await expectRedirect(()=>h.send('suspended',target),
      destination+(target===admin?'?error=self-protection':'?error=protected'));
    assert.equal(h.state.updates.length,0);
    assert.equal(h.state.audits.length,0);
  }
});

test('unauthorized caller never touches Auth or audit',async()=>{
  const h=harness({unauthorized:true});
  await assert.rejects(()=>h.send('suspended'),/unauthorized/);
  assert.equal(h.state.updates.length,0);
  assert.equal(h.state.audits.length,0);
  assert.equal(h.state.lookups.length,0);
});
