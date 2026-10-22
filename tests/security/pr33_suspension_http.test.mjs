// HTTP acceptance on the disposable local Supabase used by PR33 staged CI.
// Uses the existing synthetic, confirmed member seeded in pr33_upgrade_seed.sql.
// Never points to Demo/Production; no new user account or external email.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
import {createClient} from '@supabase/supabase-js';

const member='11111111-1111-4111-8111-111111111112';
const email='member@pr33-upgrade.invalid';
const password='Pr33-Local-Only-AuthHttp-Test-2026!';
const status=execFileSync('supabase',['status','-o','env'],{encoding:'utf8',timeout:15000});
const config=Object.fromEntries(status.split(/\r?\n/).flatMap(line=>{
 const match=line.match(/^([A-Z][A-Z_0-9]*)=(.*)$/);
 return match?[[match[1],match[2].trim().replace(/^["']|["']$/g,'')]]:[];
}));
const url=config.API_URL??config.SUPABASE_URL;
const anon=config.ANON_KEY??config.SUPABASE_ANON_KEY;
const service=config.SERVICE_ROLE_KEY??config.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url&&anon&&service,'Missing local Supabase URL/legacy JWT keys from supabase status -o env');
const endpoint=new URL(url);
assert.equal(endpoint.protocol,'http:','Only local, disposable HTTP endpoints are allowed');
assert.ok(['127.0.0.1','localhost','::1'].includes(endpoint.hostname),'Refuse nonlocal Supabase endpoint');
assert.equal(endpoint.port,'54321','Refuse nonstandard local Supabase port');

const authOptions={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}};
const admin=createClient(url,service,authOptions);
const browser=createClient(url,anon,authOptions);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oS9Vx8AAAAASUVORK5CYII=','base64');
function bearer(jwt){return {apikey:anon,Authorization:'Bearer '+jwt};}
async function profileRead(jwt){
 return fetch(url+'/rest/v1/profiles?select=id&id=eq.'+member,{
  headers:{...bearer(jwt),Accept:'application/json'}
 });
}
async function upload(jwt,filename){
 return fetch(url+'/storage/v1/object/profile-media/'+member+'/'+filename,{
  method:'POST',headers:{...bearer(jwt),'Content-Type':'image/png','x-upsert':'false'},body:png
 });
}
function ensureDenied(response,body,label){
 const authDenied=[401,403].includes(response.status);
 const policyDenied=response.status===400&&/row.level|permission.denied|not.authori[sz]ed|forbidden|suspend/i.test(body);
 assert.ok(authDenied||policyDenied,label+' not denied by authorization: HTTP '+response.status);
}
test('Supabase-issued existing JWT is denied by Data API and Storage after suspension',async()=>{
 let wasBanned=false;
 const passwordUpdated=await admin.auth.admin.updateUserById(member,{password});
 assert.ifError(passwordUpdated.error);
 assert.equal(passwordUpdated.data.user?.id,member,'Synthetic local Auth user not found');
 const {data:session,error:loginError}=await browser.auth.signInWithPassword({email,password});
 assert.ifError(loginError);
 const jwt=session.session?.access_token;
 assert.ok(jwt,'No local Auth-issued JWT');
 assert.equal(session.user.id,member);
 const originalJwt=jwt; // Reused unchanged for all post-suspension calls.

 const before=await profileRead(originalJwt);
 const beforeBody=await before.json();
 assert.equal(before.status,200,'Profile read before suspension failed');
 assert.ok(Array.isArray(beforeBody)&&beforeBody.some(x=>x.id===member),
  'Authenticated user profile not accessible before suspension');

 const beforeUpload=await upload(originalJwt,'pr33-http-before-ban.png');
 const beforeUploadBody=await beforeUpload.text();
 assert.ok([200,201].includes(beforeUpload.status),
  'Authorized profile upload failed before suspension (HTTP '+beforeUpload.status+'): '+beforeUploadBody.slice(0,250));
 try{
  const {data:banned,error:banError}=await admin.auth.admin.updateUserById(member,{ban_duration:'876000h'});
  assert.ifError(banError);
  wasBanned=true;
  assert.ok(Date.parse(banned.user?.banned_until??'')>Date.now(),
    'Local Auth admin did not suspend the user');

  const after=await profileRead(originalJwt);
  const afterBody=await after.text();
  ensureDenied(after,afterBody,'PostgREST profile read with previously issued token');

  const deniedUpload=await upload(originalJwt,'pr33-http-after-ban.png');
  const deniedBody=await deniedUpload.text();
  ensureDenied(deniedUpload,deniedBody,'Storage upload with previously issued token');

  console.log('PASS: an existing Supabase Auth-issued token cannot access Data API or upload via Storage once banned');
 } finally {
  if(wasBanned){
   const {error}=await admin.auth.admin.updateUserById(member,{ban_duration:'none'});
   assert.ifError(error);
  }
 }
});
