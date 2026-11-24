'use client';

import { useRef, useState } from 'react';
import { MentionTextarea, type SelectedMention } from '@/components/mention-textarea';
import type { PostMention } from '@/lib/post-annotations';
import { editPost } from '@/app/(app)/feed/actions';
import {CityHashtagPicker} from '@/components/city-hashtag-picker';
import {extractCityHashtags,type CityHashtagRefs} from '@/lib/city-hashtags';

export function PostEditForm({
  id,
  body: initialBody,
  mentions: initialMentions,
  annotationsEnabled,
  cityHashtagRefs,
  requiresText,
}: {
  id: string;
  body: string;
  mentions: PostMention[];
  annotationsEnabled: boolean;
  cityHashtagRefs: unknown;
  requiresText: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [mentions, setMentions] = useState<SelectedMention[]>(initialMentions);
  const initialRefs=Array.isArray(cityHashtagRefs)?cityHashtagRefs:[];
  const [cityRefs,setCityRefs]=useState<CityHashtagRefs>(Object.fromEntries(initialRefs.filter((x):x is {tag:string;cityId:string}=>!!x&&typeof x==='object'&&'tag' in x&&'cityId' in x).map(x=>[x.tag,x.cityId])));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return <form action={editPost} className="space-y-4">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="city_hashtag_refs" value={JSON.stringify(Object.entries(cityRefs).filter(([tag,cityId])=>cityId!=='__first_name__'&&extractCityHashtags(body).includes(tag)).map(([tag,cityId])=>({tag,cityId})))}/>
    {annotationsEnabled && <>
      <input type="hidden" name="annotations_enabled" value="1" />
      <input type="hidden" name="mentions" value={JSON.stringify(mentions)} />
      <MentionTextarea
        textareaRef={textareaRef}
        value={body}
        onChange={(text, selected) => { setBody(text); setMentions(selected);setCityRefs(current=>Object.fromEntries(Object.entries(current).filter(([tag])=>extractCityHashtags(text).includes(tag)))); }}
        selections={mentions}
        required={requiresText}
        rows={7}
        placeholder="Edit your post…"
      />
      <CityHashtagPicker body={body} value={cityRefs} onChange={setCityRefs}/>
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
    {!annotationsEnabled&&<CityHashtagPicker body={body} value={cityRefs} onChange={setCityRefs}/>}
    <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Save post</button>
  </form>;
}
