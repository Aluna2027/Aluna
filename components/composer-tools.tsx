'use client';
import { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip, Send, Smile, Video, X } from 'lucide-react';

const options=[{label:'Photo',icon:ImageIcon,accept:'image/jpeg,image/png,image/webp,image/gif'},{label:'Video',icon:Video,accept:'video/mp4,video/webm,video/quicktime'},{label:'Document',icon:FileText,accept:'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'}];
const emoji=['😀','😄','😊','😍','🥰','😎','🤔','👏','🙌','👍','❤️','💚','🌍','🌱','♻️','🤝','✨','🔥','🎉','💪','🙏','🚀','💡','✅','📍','🌈','😂','😢','🎯','🌳','🌻'];
export const allowedDocuments=new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
export function ComposerTools({onFile,onEmoji,selectedFile,submitDisabled,submitting}:{onFile:(file:File|null)=>void;onEmoji:(value:string)=>void;selectedFile:File|null;submitDisabled:boolean;submitting:boolean}){
 const [attachments,setAttachments]=useState(false),[emojis,setEmojis]=useState(false);
 const chooser=useRef<HTMLInputElement>(null);
 const [accept,setAccept]=useState('');
 const open=(mime:string)=>{setAccept(mime);setAttachments(false);requestAnimationFrame(()=>chooser.current?.click());};
 return <div className="space-y-2">
  <div className="relative flex items-center justify-end gap-1 border-t border-line/70 px-1 pt-1">
   <button type="button" aria-label="Attach file" aria-expanded={attachments} onClick={()=>{setAttachments(v=>!v);setEmojis(false);}} className="rounded-lg p-2 text-[#26E7D4] transition hover:bg-panel hover:shadow-[0_0_12px_#26E7D433] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#26E7D4]"><Paperclip size={19}/></button>
   <button type="button" aria-label="Choose emoji" aria-expanded={emojis} onClick={()=>{setEmojis(v=>!v);setAttachments(false);}} className="rounded-lg p-2 text-[#8A4DFF] transition hover:bg-panel hover:shadow-[0_0_12px_#8A4DFF33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8A4DFF]"><Smile size={19}/></button>
   {attachments&&<div className="absolute bottom-full left-0 z-30 mb-2 grid grid-cols-3 gap-2 rounded-xl border border-line bg-panel p-3 shadow-xl">{options.map(({label,icon:Icon,accept:types})=><button key={label} type="button" onClick={()=>open(types)} className="flex flex-col items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink hover:bg-panel-raised"><Icon size={22} className="text-gold"/>{label}</button>)}</div>}
   {emojis&&<div className="absolute bottom-full left-0 z-30 mb-2 grid w-64 grid-cols-6 gap-1 rounded-xl border border-line bg-panel p-3 shadow-xl" aria-label="Emojis">{emoji.map(e=><button key={e} type="button" aria-label={'Insert '+e} onClick={()=>{onEmoji(e);setEmojis(false);}} className="rounded-lg p-1 text-xl hover:bg-panel-raised">{e}</button>)}</div>}
   <button type="submit" aria-label={submitting?'Posting':'Post'} title={submitting?'Posting':'Post'} disabled={submitDisabled} className="rounded-lg p-2 text-[#FF4FD8] transition hover:bg-panel hover:shadow-[0_0_12px_#FF4FD833] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF4FD8] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:shadow-none"><Send size={19} strokeWidth={2.4}/></button>
   <input ref={chooser} aria-label="Choose attachment" type="file" accept={accept} className="hidden" onChange={e=>{onFile(e.target.files?.[0]??null);e.target.value='';}}/>
  </div>
  {selectedFile&&<div className="flex items-center justify-between gap-2 rounded-lg bg-panel p-2 text-xs text-ink"><span className="min-w-0 truncate">{selectedFile.name}</span><button type="button" aria-label="Remove attachment" onClick={()=>onFile(null)} className="text-muted hover:text-ink"><X size={16}/></button></div>}
 </div>;
}
