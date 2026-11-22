import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../../supabase/migrations/20261122060000_pr47_comment_edit_votes.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../components/inline-comments.tsx',import.meta.url),'utf8');
const server=readFileSync(new URL('../../app/(app)/feed/comment-actions.ts',import.meta.url),'utf8');
const data=readFileSync(new URL('../../lib/comments.ts',import.meta.url),'utf8');

test('comment editing preserves immutable creation date and validates owner and visibility',()=>{
 assert.match(sql,/update public\.comments set body=clean_body, mention_refs=p_mentions, edited_at=now\(\)/);
 assert.doesNotMatch(sql,/update public\.comments set[^;]*created_at\s*=/);
 assert.match(sql,/public\.can_act_as\(existing\.actor_id\)/);
 assert.match(sql,/public\.can_view_post\(existing\.post_id\)/);
 assert.match(sql,/update public\.comments set body=clean_body/);
 assert.match(sql,/delete from public\.comment_mentions/);
 assert.match(sql,/delete from public\.notifications n where n\.kind='comment_mention'/);
 assert.match(sql,/not exists \(select 1 from public\.comment_mentions cm/);
 assert.doesNotMatch(sql,/insert into public\.notifications/i);
});
test('votes are unique per user and cannot bypass parent visibility',()=>{
 assert.match(sql,/primary key \(comment_id, voter_id\)/);
 assert.match(sql,/auth\.users\(id\)/);
 assert.match(sql,/public\.can_view_post\(parent_post\)/);
 assert.match(sql,/public\.can_view_post\(c\.post_id\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.comment_votes from public, anon, authenticated/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/on conflict\(comment_id,voter_id\) do update/);
});
test('comment actions require an authenticated actor and use checked RPCs',()=>{
 assert.match(server,/getUser\(\)/);
 assert.match(server,/rpc\('pr47_edit_comment'/);
 assert.match(server,/rpc\('pr47_vote_comment'/);
 assert.match(data,/rpc\('pr47_comment_vote_summary'/);
});
test('comment UI renders local date next to author, controls edit and vote',()=>{
 assert.match(ui,/Intl\.DateTimeFormat/);
 assert.match(ui,/CommentTimestamp value=\{comment\.created_at\}/);
 assert.match(ui,/aria-label="Comment options"/);
 assert.match(ui,/Edit comment/);
 assert.match(ui,/Delete comment/);
 assert.match(ui,/aria-pressed=\{votes\.myVote===1\}/);
 assert.match(ui,/aria-pressed=\{votes\.myVote===-1\}/);
 assert.match(ui,/createPortal/);
});
