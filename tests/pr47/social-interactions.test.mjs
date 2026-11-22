import test from 'node:test';
import assert from 'node:assert/strict';
import { unreadLabel, mergeComments } from '../../lib/social-interactions.ts';
test('badge hides zero and caps above 99',()=>{assert.equal(unreadLabel(0),null);assert.equal(unreadLabel(1),'1');assert.equal(unreadLabel(99),'99');assert.equal(unreadLabel(100),'99+');assert.equal(unreadLabel(-1),null);});
test('delivery then mark-read transitions use current authoritative count',()=>{assert.deepEqual([0,1,2,1,0].map(unreadLabel),[null,'1','2','1',null]);});
test('comment pages deduplicate and retain ascending timestamp/id ordering around new comments',()=>{const row=(id,created_at='2026-11-21T00:00:00Z')=>({id,created_at});const initial=[row('a'),row('b')];const posted=mergeComments(initial,[row('z','2026-11-21T01:00:00Z')]);const next=mergeComments(posted,[row('b'),row('c')]);assert.deepEqual(next.map(c=>c.id),['a','b','c','z']);assert.deepEqual(next.slice(0,2),initial);assert.deepEqual(mergeComments(next,[]),next);});
