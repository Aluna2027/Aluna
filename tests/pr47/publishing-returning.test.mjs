import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261122011523_pr47_post_insert_returning_visibility.sql',import.meta.url),'utf8');
test('INSERT RETURNING SELECT policy evaluates new-row fields without looking up its id',()=>{
 const policy=sql.slice(sql.indexOf('create policy'),sql.indexOf('-- Existing callers'));
 assert.match(policy,/pr47_can_view_post_fields\(visibility,actor_id,community_id,mission_id\)/);
 assert.doesNotMatch(policy,/can_view_post\(id\)/);
});
test('field predicate keeps public/follower access and requires membership without author exception',()=>{
 const helper=sql.slice(sql.indexOf('create function'),sql.indexOf('revoke all'));
 assert.doesNotMatch(helper,/from public.posts/);
 assert.match(helper,/p_visibility='public'/);assert.match(helper,/p_visibility='followers'/);
 const member=helper.slice(helper.indexOf("p_visibility='members'"));
 assert.match(member,/m.community_id=p_community and public.can_act_as\(m.actor_id\)/);
 assert.match(member,/public.is_mission_participant\(p_mission,a.id\)/);
 assert.doesNotMatch(member,/can_act_as\(p_actor\)/);
});
