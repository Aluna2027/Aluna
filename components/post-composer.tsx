'use client';

import { FormEvent, useState } from 'react';
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
 if(!actors.length)return null;

 async function handleSubmit(event:FormEvent<HTMLFormElement>){
   const form=event.currentTarget;
   const data=new FormData(form);
   const raw=data.get('media');
   const media=raw instanceof File&&raw.size>0?raw:null;

   // Text-only posts and reposts continue through the existing server action.
   if(!media)return;

   event.preventDefault();
   setUploadError(null);
   setSubmitting(true);

   const mediaType=imageTypes.has(media.type)?'image':videoTypes.has(media.type)?'video':null;
   if(!mediaType||media.size>50*1024*1024){
     setUploadError('Choose a supported photo or video up to 50 MB.');
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

   const path=`${user.id}/${post.id}/${crypto.randomUUID()}.${fileExtension(uploadMedia)}`;
   const {error:storageError}=await client.storage.from('post-media').upload(path,uploadMedia,{contentType:uploadMedia.type,upsert:false});
   if(storageError){
     await client.from('posts').delete().eq('id',post.id);
     setUploadError('Could not upload the photo or video. Please try again.');
     setSubmitting(false);
     return;
   }

   const {error:updateError}=await client.from('posts').update({media_path:path,media_type:mediaType}).eq('id',post.id);
   if(updateError){
     await client.from('posts').delete().eq('id',post.id);
     setUploadError('Could not attach the photo or video to the post.');
     setSubmitting(false);
     return;
   }

   form.reset();
   router.push(destination(returnTo));
   router.refresh();
   setSubmitting(false);
 }

 return <form action={createPost} onSubmit={handleSubmit} encType="multipart/form-data" className="glass space-y-4 rounded-2xl p-5"><h2 className="text-lg">{repostOf?'Share this post':'Create a post'}</h2><input type="hidden" name="return_to" value={returnTo}/>{repostOf&&<input type="hidden" name="repost_of_id" value={repostOf}/>} {communityId&&<input type="hidden" name="community_id" value={communityId}/>} {missionId&&<input type="hidden" name="mission_id" value={missionId}/>}
 <textarea name="body" required maxLength={5000} rows={repostOf?2:4} placeholder="Share an update with the Aluna network…" className="w-full rounded-xl border border-line bg-panel-raised p-3 text-ink"/>
 {!repostOf&&<label className="block text-sm text-muted">Photo or video<input name="media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="mt-2 block w-full rounded-xl border border-line bg-panel-raised p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-navy"/></label>}
 {uploadError&&<p role="alert" className="text-sm text-amber-300">{uploadError}</p>}
 <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-muted">Post as <select name="actor_id" className="ml-2 rounded-lg border border-line bg-panel-raised p-2 text-ink">{actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{!communityId&&!missionId&&<label className="text-sm text-muted">Audience <select name="visibility" className="ml-2 rounded-lg border border-line bg-panel-raised p-2 text-ink"><option value="public">Everyone</option><option value="followers">Followers</option></select></label>}<button disabled={submitting} className="ml-auto rounded-lg bg-gold px-5 py-2 font-semibold text-navy hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60">{submitting?'Posting…':'Post'}</button></div></form>;
}
