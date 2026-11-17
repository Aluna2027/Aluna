import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags, activeMentionQuery, isMentionDisplayAt } from '../../lib/post-text.ts';

test('hashtags normalize case and preserve every occurrence', () => {
  const hashtags = extractHashtags('#SDG9 supports #sdg9 and #DigitalInclusion');
  assert.deepEqual(hashtags.map(item => item.key), ['sdg9', 'sdg9', 'digitalinclusion']);
  assert.equal(hashtags[0].start, 0);
});

test('hashtags support Unicode but reject space-separated tails', () => {
  assert.deepEqual(extractHashtags('Visit #Clean Water and #Inclusión'),
    [
      { label: 'Clean', key: 'clean', start: 6, end: 12 },
      { label: 'Inclusión', key: 'inclusión', start: 23, end: 33 },
    ]);
});

test('hashtags avoid matching inside words', () => {
  assert.deepEqual(extractHashtags('email#hidden valid #SDG9'), [
    { label: 'SDG9', key: 'sdg9', start: 19, end: 24 },
  ]);
});

test('mention query supports full names and only a suitable @ boundary', () => {
  const body = 'Thanks @Frank Hakkenbroek';
  assert.deepEqual(activeMentionQuery(body, body.length), {
    start: 7, end: body.length, query: 'Frank Hakkenbroek',
  });
  assert.equal(activeMentionQuery('hello@example.org', 17), null);
  assert.equal(activeMentionQuery('Thanks @Frank ', 14), null);
});

test('mention selection offsets remain in UTF-16 for emoji prefixes', () => {
  const body = '🌍 @Frank Hakkenbroek';
  assert.equal(isMentionDisplayAt(body, 3, 'Frank Hakkenbroek'), true);
  assert.equal(isMentionDisplayAt(body, 2, 'Frank Hakkenbroek'), false);
});
