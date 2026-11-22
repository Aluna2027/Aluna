'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MentionTextarea, type SelectedMention } from '@/components/mention-textarea';
import type { RenderedMention } from '@/components/post-body';
import { mergeComments } from '@/lib/social-interactions';
import type { Actor } from '@/lib/social';
import type { CommentVoteSummary } from '@/lib/comments';
import { PostBody } from '@/components/post-body';
import { commentPage, createCommentInline, deleteCommentInline, editCommentInline, voteCommentInline } from '@/app/(app)/feed/comment-actions';

export type InlineComment={
 id:string;actor_id:string;body:string;created_at:string;edited_at?:string|null;
 author:Actor|null;mentions?:RenderedMention[];votes?:CommentVoteSummary;
};

function CommentTimestamp({value}:{value:string}){
 const [localized,setLocalized]=useState('');
 useEffect(()=>{
  const d=new Date(value);
  if(Number.isNaN(d.getTime())){setLocalized('');return;}
  const parts=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value??'';
  setLocalized(`${part('day')}-${part('month')}-${part('year')} ${part('hour')}:${part('minute')}`);
 },[value]);
 return <time dateTime={value} suppressHydrationWarning className="text-sm font-semibold text-gold">{localized}</time>;
}

function CommentCard({comment,canEdit,canVote,onEdited,onDeleted}:{
 comment:InlineComment;canEdit:boolean;canVote:boolean;
 onEdited:(next:InlineComment)=>void;onDeleted:(id:string)=>void;
}){
 const [menuOpen,setMenuOpen]=useState(false),[editing,setEditing]=useState(false);
 const [body,setBody]=useState(comment.body);
 const [selectedMentions,setSelectedMentions]=useState<SelectedMention[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [votes,setVotes]=useState<CommentVoteSummary>(comment.votes??{upvotes:0,downvotes:0,myVote:0});
 const [position,setPosition]=useState({top:0,left:0});
 const buttonRef=useRef<HTMLButtonElement>(null),menuRef=useRef<HTMLDivElement>(null);
 const editorRef=useRef<HTMLTextAreaElement>(null);
 const menuId=useId();

 useEffect(()=>{
  if(!menuOpen)return;
  function reposition(){
   const rect=buttonRef.current?.getBoundingClientRect();
   if(rect)setPosition({top:Math.min(rect.bottom+6,window.innerHeight-100),left:Math.max(8,Math.min(rect.right-188,window.innerWidth-196))});
  }
  function outside(event:PointerEvent){
   if(!menuRef.current?.contains(event.target as Node)&&!buttonRef.current?.contains(event.target as Node))setMenuOpen(false);
  }
  function key(event:KeyboardEvent){if(event.key==='Escape'){setMenuOpen(false);buttonRef.current?.focus();}}
  reposition();menuRef.current?.querySelector('button')?.focus();document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
  window.addEventListener('resize',reposition);
  window.addEventListener('scroll',reposition,true);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);};
 },[menuOpen]);

 function beginEdit(){
  setBody(comment.body);
  setSelectedMentions((comment.mentions??[]).map(m=>({actorId:m.actorId,start:Array.from(comment.body).slice(0,m.start).join('').length,label:m.label})));
  setError('');setEditing(true);setMenuOpen(false);
 }
 async function save(){
  const trimmed=body.trim();if(!trimmed||trimmed.length>2000||busy)return;
  setBusy(true);setError('');
  try {
   const result=await editCommentInline(comment.id,body,JSON.stringify(selectedMentions));
   if(!result.ok){setError('Could not edit comment.');return;}
   onEdited(result.comment);setEditing(false);
  }catch{setError('Could not edit comment.');}finally{setBusy(false);}
 }
 async function remove(){
  setMenuOpen(false);
  if(!window.confirm('Delete this comment?'))return;
  setBusy(true);setError('');
  try {
   if(await deleteCommentInline(comment.id))onDeleted(comment.id);
   else setError('Could not delete comment.');
  }catch{setError('Could not delete comment.');}finally{setBusy(false);}
 }
 async function castVote(vote:1|-1){
  if(!canVote||busy)return;
  setBusy(true);setError('');
  try {
   const response=await voteCommentInline(comment.id,vote);
   if(response.ok)setVotes({upvotes:response.upvotes,downvotes:response.downvotes,myVote:response.myVote});
   else setError('Could not save vote.');
  }catch{setError('Could not save vote.');}finally{setBusy(false);}
 }
 return <div className="rounded-xl bg-panel-raised p-3">
  <div className="flex items-start justify-between gap-2">
   <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
    <Link href={comment.author?.href??'/feed'} className="text-sm font-semibold text-gold">{comment.author?.name??'Member'}</Link>
    <CommentTimestamp value={comment.created_at}/>
    {comment.edited_at&&<span className="text-xs text-muted">(edited)</span>}
   </div>
   {canEdit&&<button ref={buttonRef} type="button" aria-label="Comment options" title="Comment options" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen?menuId:undefined} disabled={busy} className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-panel hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold" onClick={()=>setMenuOpen(s=>!s)}>⋯</button>}
  </div>
  {menuOpen&&canEdit&&typeof document!=='undefined'&&createPortal(<div id={menuId} ref={menuRef} role="menu" aria-label="Comment options" onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll('button'));const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}}} style={{position:'fixed',top:position.top,left:position.left,zIndex:1000}} className="w-[180px] rounded-xl border border-line bg-panel p-1 shadow-xl">
    <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-panel-raised focus:bg-panel-raised" onClick={beginEdit}>✎ Edit comment</button>
    <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-panel-raised focus:bg-panel-raised" onClick={()=>void remove()}>Delete comment</button>
   </div>,document.body)}
  {editing?<div className="mt-2 space-y-2">
   <MentionTextarea textareaRef={editorRef} value={body} selections={selectedMentions} onChange={(next,refs)=>{setBody(next);setSelectedMentions(refs);}} rows={2} maxLength={2000} disabled={busy} />
   <div className="flex gap-2">
    <button type="button" disabled={busy||!body.trim()||body.trim().length>2000} className="rounded-lg bg-gold px-3 py-1.5 text-sm text-navy disabled:opacity-50" onClick={()=>void save()}>Save</button>
    <button type="button" disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink" onClick={()=>{setEditing(false);setError('');}}>Cancel</button>
   </div>
  </div>:<PostBody body={comment.body} mentions={comment.mentions}/>}
  <div className="mt-2 flex items-center gap-4 text-xs text-muted" role="group" aria-label="Comment votes">
   <button type="button" disabled={!canVote||busy} aria-label="Upvote comment" aria-pressed={votes.myVote===1} className={votes.myVote===1?'text-gold':'hover:text-gold'} onClick={()=>void castVote(1)}>👍 {votes.upvotes}</button>
   <button type="button" disabled={!canVote||busy} aria-label="Downvote comment" aria-pressed={votes.myVote===-1} className={votes.myVote===-1?'text-gold':'hover:text-gold'} onClick={()=>void castVote(-1)}>👎 {votes.downvotes}</button>
  </div>
  {error&&<p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
 </div>;
}

export function InlineComments({postId,actors,initial,total}:{postId:string;actors:Actor[];initial:InlineComment[];total:number}){
 const textareaRef=useRef<HTMLTextAreaElement>(null);
 const [selections,setSelections]=useState<SelectedMention[]>([]);
 const [draft,setDraft]=useState(''),[items,setItems]=useState(initial),[count,setCount]=useState(total),[cursor,setCursor]=useState(initial.at(-1)),[expanded,setExpanded]=useState(false),[error,setError]=useState(''),[pending,start]=useTransition();
 const id=useId();
 function more(){start(async()=>{try{const next=await commentPage(postId,cursor);setItems(old=>mergeComments(old,next));setCursor(next.at(-1)??cursor);setExpanded(true);setError('');}catch{setError('Could not load comments. Please try again.');}});}
 return <section aria-label="Comments" className="mt-4 border-t border-line pt-3">
  <div id={id} role="region" aria-label="Post comments" tabIndex={expanded?0:undefined} className={expanded?'max-h-[350px] space-y-3 overflow-y-auto overscroll-contain touch-pan-y pr-2':'space-y-3'}>
   {(expanded?items:items.slice(0,2)).map(comment=><CommentCard key={comment.id} comment={comment} canEdit={actors.some(a=>a.id===comment.actor_id)} canVote={actors.length>0} onEdited={next=>setItems(current=>current.map(c=>c.id===next.id?next:c))} onDeleted={commentId=>{setItems(current=>current.filter(c=>c.id!==commentId));setCount(n=>Math.max(0,n-1));}}/>)}
  </div>
  {count>2&&<div className="my-2 flex gap-4 text-sm text-gold">{(!expanded||items.length<count)&&<button type="button" disabled={pending} aria-expanded={expanded} aria-controls={id} onClick={()=>{if(items.length>2&&!expanded)setExpanded(true);else more();}}>View more comments</button>}{expanded&&<button type="button" aria-controls={id} onClick={()=>setExpanded(false)}>Show less</button>}</div>}
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  {actors.length>0&&<form className="mt-3 space-y-2" action={form=>{const body=String(form.get('body')??''),actor=String(form.get('actor_id')??'');start(async()=>{try{const result=await createCommentInline(postId,actor,body,JSON.stringify(selections));if(result.ok){setItems(old=>mergeComments(old,[result.comment]));setCount(n=>n+1);setDraft('');setSelections([]);setExpanded(true);setError('');}else setError('Could not submit comment. Please try again.');}catch{setError('Could not submit comment. Please try again.');}});}}>
   <MentionTextarea value={draft} selections={selections} textareaRef={textareaRef} onChange={(value,refs)=>{setDraft(value);setSelections(refs);}} disabled={pending} required maxLength={2000} rows={2} placeholder="Write a comment…"/>
   <div className="flex flex-wrap gap-2"><select name="actor_id" aria-label="Comment as" className="min-w-0 rounded-lg bg-panel-raised p-2">{actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button disabled={pending} className="rounded-lg bg-gold px-4 py-2 text-navy">{pending?'Saving…':'Comment'}</button></div>
  </form>}
 </section>;
}
