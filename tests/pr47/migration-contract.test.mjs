import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261117024100_pr47_post_annotations.sql',import.meta.url),'utf8');
test('migration retains legacy RPC and restricts both overloads',()=>{
 assert.doesNotMatch(sql,/drop function public\.edit_scheduled_post/i);
 for(const signature of ['uuid, text, timestamptz, text','uuid, text, timestamptz, text, jsonb']){
  assert.ok(sql.includes(`revoke all on function public.edit_scheduled_post(${signature}) from public, anon, authenticated;`));
  assert.ok(sql.includes(`grant execute on function public.edit_scheduled_post(${signature}) to authenticated;`));
 }
});
test('both RPC paths guard ownership before updating or delegating',()=>{
 const bodies=[...sql.matchAll(/create(?: or replace)? function public\.edit_scheduled_post\([\s\S]*?\$fn\$;/g)].map(x=>x[0]);
 assert.equal(bodies.length,2);
 for(const body of bodies){
  assert.match(body,/security definer set search_path = ''/);
  assert.ok(body.indexOf("raise exception 'Not permitted'") < Math.max(body.indexOf('update public.scheduled_posts'),body.indexOf('return public.edit_scheduled_post')));
  assert.match(body,/not public.can_act_as\(v_row.actor_id\)/);
 }
 assert.match(sql,/when trim\(p_body\) = v_row.body then v_row.mention_refs else '\[\]'::jsonb/);
 assert.match(sql,/v_post.mention_refs, now\(\), now\(\)/);
});

test('renamed actor references may shift while literal text and actor remain validated',()=>{
 const validator=sql.slice(sql.indexOf('create function public.pr47_validate_mention_refs'),sql.indexOf('create trigger pr47_validate_post_mentions'));
 assert.match(validator,/prior->>'actorId' = item->>'actorId'[\s\S]*prior->>'label' = item->>'label'/);
 assert.doesNotMatch(validator,/where prior = item/);
 assert.match(validator,/substring\(new.body from pos \+ 1/);
 assert.match(validator,/if was_existing is false and/);
});
test('notification and search security contracts remain present',()=>{
 assert.match(sql,/recipient <> new.actor_id and recipient_can_view and newly_mentioned/);
 assert.match(sql,/on conflict \(recipient_actor_id, target_id\)/);
 assert.match(sql,/using \(public.can_view_post\(post_id\)\)/);
 assert.match(sql,/revoke all on public.post_mentions, public.post_hashtags from public, anon, authenticated/);
 const page=readFileSync(new URL('../../app/(app)/hashtags/[tag]/page.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(page,/\.ilike\(/);
 assert.match(page,/query.limit\(21\)/);
});
test('scheduler only retries the old RPC when the new signature is absent',()=>{
 const scheduler=readFileSync(new URL('../../components/post-scheduler.tsx',import.meta.url),'utf8');
 assert.match(scheduler,/if\(r.error\?\.code==='PGRST202'&&!mentionRefs.length\)/);
});
