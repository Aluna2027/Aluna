'use client';

import { useRef, useState } from 'react';
import { MentionTextarea, type SelectedMention } from '@/components/mention-textarea';
import type { PostMention } from '@/lib/post-annotations';
import { editPost } from '@/app/(app)/feed/actions';

export function PostEditForm({
  id,
  body: initialBody,
  mentions: initialMentions,
  annotationsEnabled,
  requiresText,
}: {
  id: string;
  body: string;
  mentions: PostMention[];
  annotationsEnabled: boolean;
  requiresText: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [mentions, setMentions] = useState<SelectedMention[]>(initialMentions);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return <form action={editPost} className="space-y-4">
    <input type="hidden" name="id" value={id} />
    {annotationsEnabled && <>
      <input type="hidden" name="annotations_enabled" value="1" />
      <input type="hidden" name="mentions" value={JSON.stringify(mentions)} />
      <MentionTextarea
        textareaRef={textareaRef}
        value={body}
        onChange={(text, selected) => { setBody(text); setMentions(selected); }}
        selections={mentions}
        required={requiresText}
        rows={7}
        placeholder="Edit your post…"
      />
    </>}
    {!annotationsEnabled && <textarea
      name="body"
      value={body}
      onChange={event => setBody(event.target.value)}
      required={requiresText}
      maxLength={5000}
      rows={7}
      className="w-full rounded-xl border border-line bg-panel-raised p-3 text-ink"
    />}
    <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Save post</button>
  </form>;
}
