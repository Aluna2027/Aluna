'use client';

import { FormEvent, useRef, useState } from 'react';
import { ComposerTools, allowedDocuments } from '@/components/composer-tools';
import { MentionTextarea, type SelectedMention } from '@/components/mention-textarea';
import { toDatabaseMentions } from '@/lib/post-annotations';
import { defaultPostAudience, submittedPostAudience, type PostAudience } from '@/lib/post-audience';
import { PostScheduler } from '@/components/post-scheduler';
import { useRouter } from 'next/navigation';
import { createPost } from '@/app/(app)/feed/actions';
import { createClient } from '@/lib/supabase/client';
import type { Actor } from '@/lib/social';
import { CityHashtagPicker } from '@/components/city-hashtag-picker';
import { extractCityHashtags } from '@/lib/city-hashtags';
import type { CityHashtagRefs } from '@/lib/city-hashtags';

const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif']);
const videoTypes=new Set(['video/mp4','video/webm','video/quicktime']);

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

export function PostComposer({actors,returnTo='/feed',repostOf,repostVisibility,communityId,missionId,cityId,cityName}:{actors:Actor[];returnTo?:string;repostOf?:string;repostVisibility?:string;communityId?:string;missionId?:string;cityId?:string;cityName?:string}) {
 const contextual=!!(communityId||missionId);
 const router=useRouter();
 const [submitting,setSubmitting]=useState(false);
 const [uploadError,setUploadError]=useState<string|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [body,setBody]=useState('');
 const [mentions,setMentions]=useState<SelectedMention[]>([]);
 const [cityRefs,setCityRefs]=useState<CityHashtagRefs>({});
 const [actorId,setActorId]=useState(actors[0]?.id??'');
 const [visibility,setVisibility]=useState<PostAudience>(repostVisibility==='members'?'members':defaultPostAudience(contextual));
 const client=createClient();
 const textarea=useRef<HTMLTextAreaElement>(null);
 const updateBody=(text:string,selected:SelectedMention[])=>{
  setBody(text);setMentions(selected);
  const live=new Set(extractCityHashtags(text));
  setCityRefs(current=>Object.fromEntries(Object.entries(current).filter(([tag])=>live.has(tag))));
 };
 const insertEmoji=(value:string)=>{const el=textarea.current;const start=el?.selectionStart??body.length,end=el?.selectionEnd??start;const next=body.slice(0,start)+value+body.slice(end);const delta=value.length-(end-start);setMentions(old=>old.flatMap(m=>{const mentionEnd=m.start+m.label.length+1;if(start<mentionEnd&&end>m.start)return [];const offset=m.start>=end?m.start+delta:m.start;return next.slice(offset,offset+m.label.length+1)==='@'+m.label?[{...m,start:offset}]:[];}));setBody(next);requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+value.length,start+value.length);});};
 const hasPhotoOrVideo=!!file&&(imageTypes.has(file.type)||videoTypes.has(file.type));
 if(!actors.length)return null;

 async function handleSubmit(event:FormEvent<HTMLFormElement>){
   const form=event.currentTarget;
   const data=new FormData(form);
   const media=file;
   data.set('mentions',JSON.stringify(mentions));
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
   let postCommunityId=communityId||null,postMissionId=missionId||null;
   let visibility=submittedPostAudience(data.get('visibility'),contextual);
   if(repostOf){
     const {data:target}=await client.from('posts').select('visibility,community_id,mission_id').eq('id',repostOf).maybeSingle();
     if(!target||target.visibility==='followers'){
       setUploadError('This post cannot be shared to a broader audience.');setSubmitting(false);return;
     }
     if(target.visibility==='members'){
       visibility='members';postCommunityId=target.community_id;postMissionId=target.mission_id;
     }
   }
   if((!body&&mediaType!=='image'&&mediaType!=='video')||body.length>5000||!actorId){
     setUploadError('Add post text or choose a photo or video.');
     setSubmitting(false);
     return;
   }

   const {data:{user}}=await client.auth.getUser();
   if(!user){
     router.push('/login');
     return;
   }

   // Stage the attachment before publishing. The post (and therefore any
   // mention notification) is only created once the upload has succeeded.
   const postId=crypto.randomUUID();
   const path=`${user.id}/${postId}/${crypto.randomUUID()}-${uploadMedia.name.replace(/[^a-z0-9._-]/gi,'_').slice(-96)}`;
   const {error:storageError}=await client.storage.from('post-media').upload(path,uploadMedia,{contentType:uploadMedia.type,upsert:false});
   if(storageError){
     setUploadError('Could not upload the attachment. Please try again.');
     setSubmitting(false);
     return;
   }
   const mentionRefs=toDatabaseMentions(String(data.get('body')??''),JSON.stringify(mentions),true);
   const {error:postError}=await client.from('posts').insert({
     id:postId,actor_id:actorId,body,
     visibility,
     repost_of_id:repostOf||null,community_id:postCommunityId,mission_id:postMissionId,
     media_path:path,media_type:mediaType,
     city_id:cityId||null,
     city_hashtag_refs:Object.entries(cityRefs).filter(([tag,selectedCity])=>selectedCity!=='__first_name__'&&extractCityHashtags(body).includes(tag)).map(([tag,selectedCity])=>({tag,cityId:selectedCity})),
     ...(mentionRefs.length?{mention_refs:mentionRefs}:{}),
   });
   if(postError){
     await client.storage.from('post-media').remove([path]);
     setUploadError('Could not create the post. Please try again.');
     setSubmitting(false);
     return;
   }

   form.reset();setFile(null);setBody('');setMentions([]);
   // Followers-only posts do not appear in the public Global Feed.
   if(returnTo==='/feed'&&visibility==='followers'&&!contextual)router.push('/following');
   else router.refresh();
   setSubmitting(false);
 }

 return <form action={createPost} onSubmit={handleSubmit} encType="multipart/form-data" className="glass space-y-4 rounded-2xl p-5"><h2 className="text-lg">{repostOf?'Share this post':cityName?`Share something about ${cityName}`:'Create a post'}</h2><input type="hidden" name="return_to" value={returnTo}/>{repostOf&&<input type="hidden" name="repost_of_id" value={repostOf}/>} {communityId&&<input type="hidden" name="community_id" value={communityId}/>} {missionId&&<input type="hidden" name="mission_id" value={missionId}/>} {cityId&&<input type="hidden" name="city_id" value={cityId}/>}
 <input type="hidden" name="mentions" value={JSON.stringify(mentions)}/><input type="hidden" name="city_hashtag_refs" value={JSON.stringify(Object.entries(cityRefs).filter(([tag,selectedCity])=>selectedCity!=='__first_name__'&&extractCityHashtags(body).includes(tag)).map(([tag,selectedCity])=>({tag,cityId:selectedCity})))}/><div className="rounded-xl border border-line bg-panel-raised p-2"><MentionTextarea textareaRef={textarea} value={body} onChange={updateBody} selections={mentions} required={!hasPhotoOrVideo} rows={repostOf?2:4} placeholder={cityName?`Share an update with ${cityName}…`:'Share an update with the Aluna network…'}/><CityHashtagPicker body={body} value={cityRefs} onChange={setCityRefs}/>{!repostOf&&<ComposerTools selectedFile={file} onFile={setFile} onEmoji={insertEmoji} variant="post" submitDisabled={(!body.trim()&&!hasPhotoOrVideo)||submitting} submitting={submitting} scheduler={<PostScheduler actors={actors} actorId={actorId} body={body} mentions={mentions} file={file} visibility={visibility} communityId={communityId} missionId={missionId} cityId={cityId} cityRefs={cityRefs} onSuccess={()=>{setBody('');setMentions([]);setCityRefs({});setFile(null);router.refresh();}}/>}/>}{repostOf&&<ComposerTools selectedFile={null} onFile={()=>{}} onEmoji={insertEmoji} variant="post" submitDisabled={!body.trim()||submitting}/>}</div>
 {uploadError&&<p role="alert" className="text-sm text-amber-300">{uploadError}</p>}
 <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-muted">Post as <select name="actor_id" value={actorId} onChange={e=>setActorId(e.target.value)} className="ml-2 rounded-lg border border-line bg-panel-raised p-2 text-ink">{actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{repostVisibility==='members'?<input type="hidden" name="visibility" value="members"/>:contextual?<label className="text-sm text-muted">Audience <select aria-label="Audience" name="visibility" value={visibility} onChange={e=>setVisibility(e.target.value as PostAudience)} className="ml-2 rounded-lg border border-line bg-panel-raised p-2 text-ink"><option value="members">Members only</option><option value="public">Everyone</option></select></label>:!repostOf&&<label className="text-sm text-muted">Audience <select aria-label="Audience" name="visibility" value={visibility} onChange={e=>setVisibility(e.target.value as PostAudience)} className="ml-2 rounded-lg border border-line bg-panel-raised p-2 text-ink"><option value="public">Everyone</option><option value="followers">Followers</option></select></label>}</div></form>;
}
