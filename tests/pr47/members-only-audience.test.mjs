import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../../supabase/migrations/20261121033802_pr47_members_only_audience.sql');
const composer = read('../../components/post-composer.tsx');
const scheduler = read('../../components/post-scheduler.tsx');
const route = read('../../app/api/posts/[id]/media/route.ts');

test('contextual posts offer Members only by default and Everyone', () => {
  assert.match(composer, /defaultPostAudience\(contextual\)/);
  assert.match(composer, /<option value="members">Members only<\/option><option value="public">Everyone<\/option>/);
  assert.match(scheduler, /visibility,community_id:communityId\|\|null,mission_id:missionId\|\|null/);
  assert.match(composer, /\{repostVisibility==='members'\?[^:]+:contextual\?/);
});

test('RLS centralizes direct reads and membership feeds for all discovery surfaces', () => {
  assert.match(migration, /create or replace function public\.can_view_post\(p_post uuid\)/);
  assert.match(migration, /public\.is_mesh_member\(p\.community_id/);
  assert.match(migration, /public\.is_mission_participant\(p\.mission_id/);
  assert.match(migration, /using \(public\.can_view_post\(id\)\)/);
  assert.match(migration, /where p\.community_id=p_community/);
  assert.match(migration, /where p\.mission_id=p_mission/);
  assert.match(migration, /p\.visibility='public'/);
  assert.match(migration, /p\.visibility in \('public','followers'\)/);
  assert.match(migration, /public\.can_view_post\(target_id\)/);
});

test('published audience cannot be escalated and members reposts retain context', () => {
  assert.match(migration, /Published post audience and context cannot be changed/);
  assert.match(migration, /A members-only repost must keep its original audience/);
  assert.match(migration, /r\.visibility='members' and p_visibility<>'members'/);
});

test('members media requires the authenticated RLS session and streams ranges privately', () => {
  assert.match(route, /client\.auth\.getUser\(\)/);
  assert.match(route, /client\.from\('posts'\)\.select\('media_path,media_type,visibility'\)/);
  assert.match(route, /authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(route, /request\.headers\.get\('range'\)/);
  assert.match(route, /cache-control': 'private, no-store'/);
  assert.doesNotMatch(route, /service_role|createSignedUrl/);
});
