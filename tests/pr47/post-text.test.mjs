import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags, activeMentionQuery, isMentionDisplayAt, normalizeHashtagKey } from '../../lib/post-text.ts';

test('hashtag search accepts combining marks introduced by Unicode lowercasing', () => {
  const [tag] = extractHashtags('#İstanbul');
  assert.equal(tag.key, 'i\u0307stanbul');
  assert.equal(normalizeHashtagKey(tag.key), tag.key);
  assert.equal(normalizeHashtagKey('İstanbul'), tag.key);
  assert.equal(normalizeHashtagKey('ＳＤＧ９'), 'sdg9');
  for (const invalid of ['two words', '<script>', 'tag,or(private)', '\u0307', 'a'.repeat(65)]) {
    assert.equal(normalizeHashtagKey(invalid), null);
  }
});

test('decomposed and non-Latin combining marks stay inside hashtag labels', () => {
  for (const [body, key] of [['#Cafe\u0301', 'café'], ['#हिन्दी', 'हिन्दी'], ['#İstanbul', 'i\u0307stanbul']]) {
    const tags = extractHashtags(body);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].label, body.slice(1));
    assert.equal(tags[0].key, key);
    assert.equal(tags[0].end, body.length);
  }
  assert.deepEqual(extractHashtags('e\u0301#hidden #\u0301invalid'), []);
});

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

test('hashtag keys longer than the indexed limit stay plain text', () => {
  assert.deepEqual(extractHashtags('#' + 'a'.repeat(65)), []);
});

test('mention query supports full names and only a suitable @ boundary', () => {
  const body = 'Thanks @Frank Hakkenbroek';
  assert.deepEqual(activeMentionQuery(body, body.length), {
    start: 7, end: body.length, query: 'Frank Hakkenbroek',
  });
  assert.equal(activeMentionQuery('hello@example.org', 17), null);
  assert.deepEqual(activeMentionQuery('Thanks @Frank ', 14), { start: 7, end: 14, query: 'Frank ' });
});

test('mention selection offsets remain in UTF-16 for emoji prefixes', () => {
  const body = '🌍 @Frank Hakkenbroek';
  assert.equal(isMentionDisplayAt(body, 3, 'Frank Hakkenbroek'), true);
  assert.equal(isMentionDisplayAt(body, 2, 'Frank Hakkenbroek'), false);
});
