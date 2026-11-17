/**
 * Shared parsing rules for PR47 post mentions and hashtags.
 * These utilities deliberately do not guess an account from visible @text:
 * a mention becomes a reference only after the author selects an Actor.
 */
export type Hashtag = { label: string; key: string; start: number; end: number };
export type MentionQuery = { start: number; end: number; query: string };

const word = /[\p{L}\p{N}_]/u;
const hashtagPattern = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;

export function extractHashtags(body: string): Hashtag[] {
  const results: Hashtag[] = [];
  for (const match of body.matchAll(hashtagPattern)) {
    const prefix = match[1] ?? '';
    const label = match[2] ?? '';
    const start = (match.index ?? 0) + prefix.length;
    const key = label.normalize('NFKC').toLowerCase();
    if (!key) continue;
    results.push({ label, key, start, end: start + 1 + label.length });
  }
  return results;
}

/**
 * Finds the @ mention currently being typed. Spaces are allowed in display
 * names; a completed mention is resolved only through a selected actor ID.
 */
export function activeMentionQuery(body: string, cursor: number): MentionQuery | null {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > body.length) return null;
  const before = body.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0 || (at > 0 && word.test(before[at - 1]))) return null;
  const query = before.slice(at + 1);
  if (query.length > 64 || /[\r\n@]/u.test(query)) return null;
  if (query.startsWith(' ') || query.endsWith('  ')) return null;
  return { start: at, end: cursor, query };
}

export function isMentionDisplayAt(
  body: string,
  start: number,
  displayName: string,
): boolean {
  return Number.isInteger(start)
    && start >= 0
    && body.slice(start, start + displayName.length + 1) === '@' + displayName
    && (start === 0 || !word.test(body[start - 1]));
}
