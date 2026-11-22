import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261121033802_pr47_members_only_audience.sql',import.meta.url),'utf8');
test('read authorization does not recurse or grant members authors a permanent exception',()=>{
 const view=sql.slice(sql.indexOf('create or replace function public.can_view_post'),sql.indexOf('revoke all on function public.can_view_post'));
 assert.equal((view.match(/public\.can_view_post\(/g)||[]).length,1);
 assert.match(view,/visibility<>'members' and public.can_act_as/);
 assert.match(sql,/p.id=any\(c.visited\)/);
 assert.match(sql,/where not c.cycle/);
 assert.match(sql,/tg_op='INSERT' and new.repost_of_id is not null/);
});
test('all member notification generators pass recipient and self-suppression gate',()=>{
 assert.match(sql,/before insert on public.notifications/);
 assert.match(sql,/not public.pr47_comment_recipient_can_view\(parent_id,new.recipient_actor_id\)/);
 assert.match(sql,/public.can_act_as\(new.recipient_actor_id\)/);
 assert.match(sql,/not exists\(select 1 from access where not allowed\)/);
});
test('scheduled media replaces the permissive owner policy and requires current membership',()=>{
 const policy=sql.slice(sql.indexOf('drop policy "Read own scheduled post media"'));
 assert.match(policy,/public.can_act_as\(s.actor_id\)/);
 assert.match(policy,/public.is_mesh_member\(s.community_id,s.actor_id\)/);
 assert.match(policy,/public.is_mission_participant\(s.mission_id,s.actor_id\)/);
 assert.match(policy,/not exists\(select 1 from public.posts p where p.id=s.id\)/);
});
