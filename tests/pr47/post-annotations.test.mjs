import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDatabaseMentions, readMentionDrafts, toDatabaseMentions } from '../../lib/post-annotations.ts';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

test('normalizes selected mentions to code-point offsets after emoji and trimming', () => {
  const body = '  🌍 @Zoë Organization  ';
  const mention = { actorId: user, start: body.indexOf('@'), label: 'Zoë Organization' };
  assert.deepEqual(toDatabaseMentions(body, JSON.stringify([mention]), true), [
    { actorId: user, start: 2, label: 'Zoë Organization' },
  ]);
});

test('converts persisted code-point offsets back to textarea UTF-16 offsets', () => {
  const body = '🌍 @Zoë Organization';
  const persisted = [{ actor_id: user, start_offset: 2, label: 'Zoë Organization' }];
  assert.deepEqual(fromDatabaseMentions(body, persisted), [
    { actorId: user, start: 3, label: 'Zoë Organization' },
  ]);
});

test('rejects forged IDs, invalid positions, and names that do not match text', () => {
  const body = 'Hello @Zoë';
  const valid = { actorId: user, start: 6, label: 'Zoë' };
  assert.deepEqual(readMentionDrafts(body, JSON.stringify([
    valid,
    { ...valid, actorId: 'not-a-uuid' },
    { ...valid, start: 0 },
    { ...valid, label: 'Other' },
  ])), [valid]);
});

test('rejects overlapping references without allowing a later reference to overlap the first', () => {
  const body = '@First @Second @Third';
  const selected = [
    { actorId: user, start: 0, label: 'First @Second @Third' },
    { actorId: other, start: 7, label: 'Second' },
    { actorId: other, start: 15, label: 'Third' },
  ];
  assert.deepEqual(readMentionDrafts(body, JSON.stringify(selected)), [selected[0]]);
});

test('rejects non-array and oversized mention payloads safely', () => {
  assert.deepEqual(readMentionDrafts('@Zoë', JSON.stringify({ actorId: user })), []);
  assert.deepEqual(readMentionDrafts('@Zoë', 'x'.repeat(16001)), []);
});

test('scheduled JSON survives load and save with stable actor and original name', () => {
  const body = '🌍 @Zoë Organization';
  const refs = [{actorId:user,start:2,label:'Zoë Organization'}];
  assert.deepEqual(toDatabaseMentions(body, JSON.stringify(fromDatabaseMentions(body, refs))), refs);
  assert.deepEqual(fromDatabaseMentions(body, null), []);
  assert.deepEqual(fromDatabaseMentions(body, []), []);
});
