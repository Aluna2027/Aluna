import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const sql=read('../../supabase/migrations/20261122022405_pr47_conversation_controls.sql');
test('direct message insert is guarded before notifications and serializes with controls',()=>{
 assert.match(sql,/before insert on public.direct_messages/);
 assert.match(sql,/blocker_actor_id=peer and blocked_actor_id=new.sender_actor_id/);
 assert.equal((sql.match(/where id=(?:p_conversation|new.conversation_id) for update/g)||[]).length,2);
 assert.match(sql,/not public.can_act_as\(new.sender_actor_id\)/);
 assert.match(sql,/p_actor not in\(c.actor_a,c.actor_b\)/);
 assert.match(sql,/revoke all on public.message_blocks from public,anon,authenticated/);
});
test('delete hides per profile without deleting shared messages and accepted send restores inbox',()=>{
 assert.match(sql,/values\(auth.uid\(\),c.id,clock_timestamp\(\)\)/);
 assert.match(sql,/delete from public.conversation_hidden where conversation_id=c.id/);
 assert.doesNotMatch(sql,/delete from public.(?:direct_messages|conversations)\b/);
 assert.match(sql,/h.profile_id=auth.uid\(\) and h.conversation_id=c.id/);
});
test('notifications filter read state and only View marks selected row before redirect',()=>{
 const page=read('../../app/(app)/notifications/page.tsx'),action=read('../../app/(app)/notifications/actions.ts');
 assert.match(page,/eq\('is_read',history\)/);assert.match(page,/form action={viewNotification}/);
 assert.doesNotMatch(page,/Mark read|update\(/);
 assert.ok(action.indexOf("update({is_read:true})")<action.indexOf('redirect(destination)'));
 assert.match(action,/if\(error\|\|!data\)redirect/);
});
