import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const sql=read('../../supabase/migrations/20261121033802_pr47_members_only_audience.sql');
const route=read('../../app/api/posts/[id]/media/route.ts');
test('member Storage references are denied by a restrictive policy even when hidden by RLS',()=>{
 assert.match(sql,/as restrictive\s+for select to anon,authenticated/);
 assert.match(sql,/pr47_storage_client_readable[\s\S]*security definer/);
 assert.match(sql,/p.visibility='members'/);assert.match(sql,/s.visibility='members'/);
 assert.match(sql,/where id='post-media' and not public/);
});
test('server reads only an RLS-authorized post path and never creates signed URLs',()=>{
 assert.ok(route.indexOf("client.from('posts')")<route.indexOf('process.env.SUPABASE_SERVICE_ROLE_KEY'));
 assert.match(route,/parts\[1\] !== id/);assert.match(route,/status: 503/);
 assert.match(route,/redirect: 'error'/);assert.match(route,/signal: request.signal/);
 assert.match(route,/status: 416/);assert.match(route,/private, no-store/);
 assert.doesNotMatch(route,/createSignedUrl|NextResponse.redirect/);
});
