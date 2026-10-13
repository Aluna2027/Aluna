'use client';

import { FormEvent, useRef, useState } from 'react';
import { ComposerTools, allowedDocuments } from '@/components/composer-tools';
import { useRouter } from 'next/navigation';
import { createPost } from '@/app/(app)/feed/actions';
import { createClient } from '@/lib/supabase/client';
import type { Actor } from '@/lib/social';

const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif']);
const videoTypes=new Set(['video/mp4','video/webm','video/quicktime']);

function fileExtension(file:File){
 return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||(file.type.startsWith('image/')?'jpg':'mp4');
}

function destination(returnTo:string){
 if(/^\/(communities|missions)\/[0-9a-f-]{36}$/i.test(returnTo)) return `${returnTo}?tab=${returnTo.startsWith('/missions/')?'posts':'feed'}`;
 return returnTo;
}

async function normalizeGlobalFeedImage(file:File){
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('image'));img.src=url;});
  if(image.naturalWidth===1080&&image.naturalHeight===1920)return file;
  const targetW=1080,targetH=1920;
  const scale=Math.min(targetW/image.naturalWidth,targetH/image.naturalHeight,1);
  const outputW=Math.max(1,Math.round(image.naturalWidth*scale));
  const outputH=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=outputW;canvas.height=outputH;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas');
  ctx.drawImage(image,0,0,image.naturalWidth,image.naturalHeight,0,0,outputW,outputH);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('blob')),'image/jpeg',0.92));
  const base=file.name.replace(/\.[^.]+$/,'')||'photo';
  return new File([blob],`${base}-feed.jpg`,{type:'image/jpeg'});
 } finally {URL.revokeObjectURL(url);}
}

export function PostComposer({actors,returnTo='/feed',repostOf,communityId,missionId}:{actors:Actor[];returnTo?:string;repostOf?:string;communityId?:string;missionId?:string}) {
 const router=useRouter();
 const [submitting,setSubmitting]=useState(false);
 const [uploadError,setUploadError]=useState<string|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [body,setBody]=useState('');
 const textarea=useRef<HTMLTextAreaElement>(null);
 const insertEmoji=(value:string)=>{const el=textarea.current;const start=el?.selectionStart??body.length,end=el?.selectionEnd??start;setBody(text=>text.slice(0,start)+value+text.slice(end));requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+value.length,start+value.length);});};
 if(!actors.length)return null;

 async function handleSubmit(event:FormEvent<HTMLFormElement>){
   const form=event.currentTarget;
   const data=new FormData(form);
   const media=file;
   if(media)data.set('media',media);

   // Text-only posts and reposts continue through the existing server action.
   if(!media)return;

   event.preventDefault();
   setUploadError(null);
   setSubmitting(true);

   const mediaType=imageTypes.has(media.type)?'image':videoTypes.has(media.type)?'video':allowedDocuments.has(media.type)?'document':null;
   if(!mediaType||media.size>50*1024*1024){
     setUploadError('Choose a supported photo, video or document up to 50 MB.');
     setSubmitting(false);
     return;
   }

   let uploadMedia=media;
   if(mediaType==='image'&&returnTo==='/feed'){
     try{uploadMedia=await normalizeGlobalFeedImage(media);}catch{setUploadError('Could not prepare this photo for the Global Feed. Please choose another image.');setSubmitting(false);return;}
   }

   const body=String(data.get('body')??'').trim();
   const actorId=String(data.get('actor_id')??'');
   const visibility=data.get('visibility')==='followers'?'followers':'public';
   if(!body||body.length>5000||!actorId){
     setUploadError('Add post text and try again.');
     setSubmitting(false);
     return;
   }

   const client=createClient();
   const {data:{user}}=await client.auth.getUser();
   if(!user){
     router.push('/login');
     return;
   }

   const {data:post,error:postError}=await client.from('posts').insert({
     actor_id:actorId,
     body,
     visibility:communityId||missionId?'public':visibility,
     repost_of_id:repostOf||null,
     community_id:communityId||null,
     mission_id:missionId||null,
   }).select('id').single();

   if(postError||!post){
     setUploadError('Could not create the post. Please try again.');
     setSubmitting(false);
     return;
   }

   const path=`${user.id}/${post.id}/${crypto.randomUUID()}-${uploadMedia.name.replace(/[^a-z0-9._-]/gi,'_').slice(-96)}`;
   const {error:storageError}=await client.storage.from('post-media').upload(path,uploadMedia,{contentType:uploadMedia.type,upsert:false});
   if(storageError){
     await client.from('posts').delete().eq('id',post.id);
     setUploadError('Could not upload the attachment. Please try again.');
     setSubmitting(false);
     return;
   }

   const {error:updateError}=await client.from('posts').update({media_path:path,media_type:mediaType}).eq('id',post.id);
   if(updateError){
     await client.from('posts').delete().eq('id',post.id);
     setUploadError('Could not attach the file to the post.');
     setSubmitting(false);
     return;
   }

   form.reset();setFile(null);setBody('');
   // Followers-only posts do not appear in the public Global Feed.
   if(returnTo==='/feed'&&visibility==='followers'&&!communityId&&!missionId)router.push('/following');
   else router.refresh();
   setSubmitting(false);
 }

 return <form action={createPost} onSubmit={handleSubmit} encType="multipart/form-data" className="glass space-y-4 rounded-2xl p-5"><h2 className="text-lg">{repostOf?'Share this post':'Create a post'}</h2><input type="hidden" name="return_to" value={returnTo}/>{repostOf&&<input type="hidden" name="repost_of_id" value={repostOf}/>} {communityId&&<input type="hidden" name="community_id" value={communityId}/>} {missionId&&<input type="hidden" name="mission_id" value={missionId}/>}
 <div className="rounded-xl border border-line bg-panel-raised p-2"><textarea ref={textarea} name="body" value={body} onChange={e=>setBody(e.target.value)} required maxLength={5000} rows={repostOf?2:4} placeholder="Share an update with the Aluna network…" className="w-full resize-y border-0 bg-transparent p-2 text-ink"/>{!repostOf&&<ComposerTools selectedFile={file} onFile={setFile} onEmoji={insertEmoji} submitDisabled={!body.trim()||submitting} submitting={submitting}/>}{repostOf&&<ComposerTools selectedFile={null} onFile={()=>{}} onEmoji={insertEmoji} submitDisabled={!body.trim()||submitting} submitting={submitting}/>}</div>
 {uploadError&&<p role="alert" className="text-sm text-amber-300">{uploadError}</p>}
 <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-muted">Post as <select name="actor_id" className="ml-2 rounded-lg border border-line bg-panel-raised p-2 text-ink">{actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{!communityId&&!missionId&&<label className="text-sm text-muted">Audience <select name="visibility" className="ml-2 rounded-lg border border-line bg-panel-raised p-2 text-ink"><option value="public">Everyone</option><option value="followers">Followers</option></select></label>}</div></form>;
}
