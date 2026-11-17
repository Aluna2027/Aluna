import { isMentionDisplayAt } from '@/lib/post-text';

export type PostMention = {
  actorId: string;
  start: number;
  label: string;
};

/**
 * Keeps a published annotation tied to exactly the selected text, rather than
 * resolving arbitrary @words to whoever happens to have that name later.
 * Offsets are UTF-16 indices, matching HTML textarea selectionStart.
 */
export function sanitizeMentionDrafts(body: string, input: unknown): PostMention[] {
  if (!Array.isArray(input) || input.length > 30) return [];
  const valid: PostMention[] = [];
  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object') continue;
    const { actorId, start, label } = candidate as Record<string, unknown>;
    if (typeof actorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)) continue;
    if (typeof label !== 'string' || !label.trim() || label.length > 150) continue;
    if (typeof start !== 'number' || !Number.isInteger(start)) continue;
    if (!isMentionDisplayAt(body, start, label)) continue;
    valid.push({ actorId, start, label });
  }
  valid.sort((a, b) => a.start - b.start);
  return valid.filter((item, index) =>
    index === 0 || item.start >= valid[index - 1].start + valid[index - 1].label.length + 1
  );
}

export function readMentionDrafts(body: string, raw: string | null): PostMention[] {
  if (!raw || raw.length > 16000) return [];
  try {
    return sanitizeMentionDrafts(body, JSON.parse(raw));
  } catch {
    return [];
  }
}
