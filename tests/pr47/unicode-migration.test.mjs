import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractHashtags} from '../../lib/post-text.ts';

const sql=readFileSync(new URL('../../supabase/migrations/20261117085129_pr47_unicode_hashtag_tokens.sql',import.meta.url),'utf8');
const literal=sql.match(/regexp_matches\(p_body, U&'([^']+)'/)[1];
const decoded=literal.replace(/\\(?:\+([0-9a-f]{6})|([0-9a-f]{4}))/gi,(_,six,four)=>String.fromCodePoint(parseInt(six??four,16)));

test('prepared SQL character ranges match frontend token boundaries for combining scripts',()=>{
  for(const text of ['#Cafe\u0301 #café','#हिन्दी #বাংলা','#İstanbul #東京 #ＳＤＧ９','e\u0301#hidden #\u0301invalid','🌍 #a\u0308']){
    const labels=[...text.matchAll(new RegExp(decoded,'gu'))].map(m=>m[2]);
    assert.deepEqual(labels,extractHashtags(text).map(t=>t.label));
  }
});

test('forward correction preserves original migration and restricts changes to derived tags',()=>{
  assert.match(sql,/revoke all on function public.pr47_hashtag_keys\(text\) from public, anon, authenticated/);
  assert.doesNotMatch(sql,/alter table|drop |update public.posts|update public.notifications/i);
  assert.match(sql,/delete from public.post_hashtags indexed using public.posts post/);
  assert.match(sql,/indexed.post_id = post.id/);
  assert.ok(sql.trim().endsWith('commit;'));
});
