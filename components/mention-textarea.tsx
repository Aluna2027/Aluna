'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { activeMentionQuery, isMentionDisplayAt } from '@/lib/post-text';

export type SelectedMention = { actorId: string; start: number; label: string };
type Candidate = { id: string; name: string; kind: 'user' | 'organization'; avatar: string | null; href: string };
type Props = {
  value: string;
  onChange: (value: string, selections: SelectedMention[]) => void;
  selections: SelectedMention[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  disabled?: boolean;
};

export function MentionTextarea({ value, onChange, selections, textareaRef, rows = 4, placeholder, required, maxLength=5000, disabled=false }: Props) {
  const listId = useId();
  const [cursor, setCursor] = useState(0);
  const [results, setResults] = useState<Candidate[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const composing = useRef(false);
  const listRef=useRef<HTMLDivElement>(null);
  const requestRef=useRef<AbortController|null>(null);
  const nextRef=useRef<string|null>(null);
  const busyRef=useRef(false);
  const [hasMore,setHasMore]=useState(false);
  const [pageError,setPageError]=useState(false);
  const active = activeMentionQuery(value, cursor);
  const query = active?.query.trim() ?? '';
  const completed = active !== null && selections.some(item =>
    item.start === active.start && cursor >= item.start + item.label.length + 1);
  const show = active !== null && query.length > 0 && !completed && !composing.current;

  useEffect(() => {
    if (!show) return;
    requestRef.current?.abort();
    nextRef.current=null;setHasMore(false);setResults([]);setIndex(0);setPageError(false);
    const controller = new AbortController();requestRef.current=controller;busyRef.current=true;
    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/mentions?q=' + encodeURIComponent(query), {
          signal: controller.signal,
          credentials: 'same-origin',
        });
        if (!response.ok) { setResults([]); return; }
        const payload: { results?: Candidate[];nextCursor?:string|null } = await response.json();
        setResults(payload.results ?? []);nextRef.current=payload.nextCursor??null;setHasMore(!!payload.nextCursor);
        setIndex(0);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted){setLoading(false);busyRef.current=false;}
      }
    }, 200);
    return () => { controller.abort();requestRef.current?.abort();busyRef.current=false; clearTimeout(delay); };
  }, [query, show]);

  useEffect(()=>{listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[index]);
  async function loadMore(){
    const cursor=nextRef.current;if(!cursor||busyRef.current)return;
    busyRef.current=true;setLoading(true);setPageError(false);
    const controller=new AbortController();requestRef.current=controller;
    try{const response=await fetch('/api/mentions?q='+encodeURIComponent(query)+'&cursor='+encodeURIComponent(cursor),{signal:controller.signal,credentials:'same-origin'});if(!response.ok)throw new Error();const payload=await response.json() as {results:Candidate[];nextCursor:string|null};if(controller.signal.aborted)return;setResults(old=>[...old,...payload.results.filter(row=>!old.some(item=>item.id===row.id))]);nextRef.current=payload.nextCursor;setHasMore(!!payload.nextCursor);}catch{if(!controller.signal.aborted)setPageError(true);}finally{if(!controller.signal.aborted){busyRef.current=false;setLoading(false);}}
  }
  useEffect(()=>()=>{requestRef.current?.abort();},[]);
  function update(next: string, position: number) {
    // Keep selections only if their literal text still exists at the updated
    // location. Changes within or before a mention invalidate stale offsets.
    // Textarea offsets use UTF-16 code units; spreading into code points would
    // corrupt selection positions when a post contains emoji before @.
    let common = 0;
    while (common < value.length && common < next.length && value[common] === next[common]) common++;
    let suffix = 0;
    while (suffix < value.length - common && suffix < next.length - common &&
      value[value.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
    const removedEnd = value.length - suffix;
    const delta = next.length - value.length;
    const retained = selections.flatMap(item => {
      if (item.start < removedEnd && item.start + item.label.length + 1 > common) return [];
      const start = item.start >= removedEnd ? item.start + delta : item.start;
      return isMentionDisplayAt(next, start, item.label) ? [{ ...item, start }] : [];
    });
    setCursor(position);
    onChange(next, retained);
  }

  function select(item: Candidate) {
    const at = activeMentionQuery(value, cursor);
    const textarea = textareaRef.current;
    if (!at || !textarea) return;
    const label = item.name;
    const insert = '@' + label;
    const replacement = insert + ' ';
    const next = value.slice(0, at.start) + replacement + value.slice(at.end);
    const delta = replacement.length - (at.end - at.start);
    const retained = selections.flatMap(selection => {
      if (selection.start < at.end && selection.start + selection.label.length + 1 > at.start) return [];
      const start = selection.start >= at.end ? selection.start + delta : selection.start;
      return isMentionDisplayAt(next, start, selection.label) ? [{ ...selection, start }] : [];
    });
    onChange(next, [...retained, { actorId: item.id, start: at.start, label }]);
    setResults([]);
    const point = at.start + replacement.length;
    setCursor(point);
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(point, point); });
  }

  return <div className="relative">
    <textarea
      ref={textareaRef} name="body" value={value}
      rows={rows} placeholder={placeholder} required={required} maxLength={maxLength} disabled={disabled}
      aria-autocomplete="list" aria-controls={show ? listId : undefined}
      aria-activedescendant={show && results[index] ? listId + '-' + index : undefined}
      className="w-full resize-y border-0 bg-transparent p-2 text-ink"
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={event => { composing.current = false; setCursor(event.currentTarget.selectionStart); }}
      onChange={event => update(event.target.value, event.target.selectionStart)}
      onClick={event => setCursor(event.currentTarget.selectionStart)}
      onKeyUp={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End')
          setCursor(event.currentTarget.selectionStart);
      }}
      onKeyDown={event => {
        if (!show || !results.length) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); if(index===results.length-1&&hasMore){void loadMore();}else setIndex(i => (i + 1) % results.length); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(i => (i - 1 + results.length) % results.length); }
        if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); select(results[index]); }
        if (event.key === 'Escape') { event.preventDefault(); setResults([]); setCursor(-1); }
      }}
    />
    {show && (loading || hasMore || results.length > 0) && <div
      ref={listRef} onScroll={event=>{const el=event.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<48)void loadMore();}} id={listId} role="listbox" aria-label="Mention a person or organization"
      className="absolute left-0 right-0 top-full z-40 max-h-64 overflow-y-auto overscroll-contain touch-pan-y rounded-xl border border-line bg-panel p-2 shadow-xl"
    >
      {loading && !results.length && <p className="p-2 text-sm text-muted">Searching…</p>}
      {results.map((item, i) => <button
        key={item.id} type="button" id={listId + '-' + i} role="option"
        aria-selected={index === i}
        onMouseDown={event => event.preventDefault()}
        onClick={() => select(item)}
        className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-panel-raised ${index === i ? 'bg-panel-raised' : ''}`}
      >
        {item.avatar ? <img src={item.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> :
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-panel-raised">@</span>}
        <span className="min-w-0"><span className="block truncate text-ink">{item.name}</span>
          <span className="text-xs text-muted">{item.kind === 'user' ? 'Person' : 'Organization'}</span></span>
      </button>)}
      {hasMore&&<button type="button" disabled={loading} onMouseDown={event=>event.preventDefault()} onClick={()=>{void loadMore();}} className="w-full p-2 text-sm text-gold">{loading?'Loading…':pageError?'Retry loading profiles':'Load more profiles'}</button>}
    </div>}
  </div>;
}
