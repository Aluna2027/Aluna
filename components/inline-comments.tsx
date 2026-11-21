'use client';
import { useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { MentionTextarea, type SelectedMention } from '@/components/mention-textarea';
import type { RenderedMention } from '@/components/post-body';
import { mergeComments } from '@/lib/social-interactions';
import type { Actor } from '@/lib/social';
import { PostBody } from '@/components/post-body';
import { commentPage, createCommentInline, deleteCommentInline } from '@/app/(app)/feed/comment-actions';
export type InlineComment={id:string;actor_id:string;body:string;created_at:string;author:Actor|null;mentions?:RenderedMention[]};
export function InlineComments({postId,actors,initial,total}:{postId:string;actors:Actor[];initial:InlineComment[];total:number}){
 const textareaRef=useRef<HTMLTextAreaElement>(null);const [selections,setSelections]=useState<SelectedMention[]>([]);
 const [draft,setDraft]=useState(''),[items,setItems]=useState(initial),[count,setCount]=useState(total),[cursor,setCursor]=useState(initial.at(-1)),[expanded,setExpanded]=useState(false),[error,setError]=useState(''),[pending,start]=useTransition();const id=useId();
 function more(){start(async()=>{try{const next=await commentPage(postId,cursor);setItems(old=>mergeComments(old,next));setCursor(next.at(-1)??cursor);setExpanded(true);setError('');}catch{setError('Could not load comments. Please try again.');}});}
 return <section aria-label="Comments" className="mt-4 border-t border-line pt-3">
 <div id={id} role="region" aria-label="Post comments" tabIndex={expanded?0:undefined} className={expanded?'max-h-[350px] space-y-3 overflow-y-auto overscroll-contain touch-pan-y pr-2':'space-y-3'}>
 {(expanded?items:items.slice(0,2)).map(comment=><div key={comment.id} className="rounded-xl bg-panel-raised p-3"><Link href={comment.author?.href??'/feed'} className="text-sm font-semibold text-gold">{comment.author?.name??'Member'}</Link><PostBody body={comment.body} mentions={comment.mentions}/>{actors.some(a=>a.id===comment.actor_id)&&<button type="button" disabled={pending} className="mt-1 text-xs text-red-300" onClick={()=>start(async()=>{if(await deleteCommentInline(comment.id)){setItems(old=>old.filter(c=>c.id!==comment.id));setCount(n=>n-1);}else setError('Could not delete comment.');})}>Delete comment</button>}</div>)}
 </div>
 {count>2&&<div className="my-2 flex gap-4 text-sm text-gold">{(!expanded||items.length<count)&&<button type="button" disabled={pending} aria-expanded={expanded} aria-controls={id} onClick={()=>{if(items.length>2&&!expanded)setExpanded(true);else more();}}>View more comments</button>}{expanded&&<button type="button" aria-controls={id} onClick={()=>setExpanded(false)}>Show less</button>}</div>}
 {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
 {actors.length>0&&<form className="mt-3 space-y-2" action={form=>{const body=String(form.get('body')??''),actor=String(form.get('actor_id')??'');start(async()=>{const result=await createCommentInline(postId,actor,body,JSON.stringify(selections));if(result.ok){setItems(old=>mergeComments(old,[result.comment]));setCount(n=>n+1);setDraft('');setSelections([]);setExpanded(true);setError('');}else setError('Could not submit comment. Please try again.');});}}><MentionTextarea value={draft} selections={selections} textareaRef={textareaRef} onChange={(value,refs)=>{setDraft(value);setSelections(refs);}} disabled={pending} required maxLength={2000} rows={2} placeholder="Write a comment…"/><div className="flex flex-wrap gap-2"><select name="actor_id" aria-label="Comment as" className="min-w-0 rounded-lg bg-panel-raised p-2">{actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button disabled={pending} className="rounded-lg bg-gold px-4 py-2 text-navy">{pending?'Saving…':'Comment'}</button></div></form>}
 </section>;
}
