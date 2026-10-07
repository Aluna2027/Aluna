'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShareLink } from '@/components/share-link';
import type { Actor } from '@/lib/social';

type Vote = 1|-1;

export function PostVoteControls({
 postId,
 commentCount,
 actors,
 initialUpvotes,
 initialDownvotes,
 initialActorVotes,
 showComments=true,
}:{
 postId:string;
 commentCount:number;
 actors:Actor[];
 initialUpvotes:number;
 initialDownvotes:number;
 initialActorVotes:Record<string,Vote>;
 showComments?:boolean;
}) {
 const [selectedActor,setSelectedActor]=useState(actors[0]?.id??'');
 const [upvotes,setUpvotes]=useState(initialUpvotes);
 const [downvotes,setDownvotes]=useState(initialDownvotes);
 const [actorVotes,setActorVotes]=useState<Record<string,Vote>>({...initialActorVotes});
 const [pending,startTransition]=useTransition();

 function castVote(vote:Vote) {
   if(!selectedActor||pending)return;
   const previous=actorVotes[selectedActor]??0;
   const next=previous===vote?0:vote;
   const previousUpvotes=upvotes,previousDownvotes=downvotes,previousVotes={...actorVotes};
   setUpvotes(upvotes-(previous===1?1:0)+(next===1?1:0));
   setDownvotes(downvotes-(previous===-1?1:0)+(next===-1?1:0));
   setActorVotes(current=>{const updated={...current};if(next===0)delete updated[selectedActor];else updated[selectedActor]=next;return updated;});

   startTransition(async()=>{
     const client=createClient();
     let error=null;
     if(previous!==0){
       const removed=await client.from('reactions').delete().eq('post_id',postId).eq('actor_id',selectedActor);
       error=removed.error;
     }
     if(!error&&next!==0){
       const inserted=await client.from('reactions').insert({post_id:postId,actor_id:selectedActor,vote:next});
       error=inserted.error;
     }
     if(error){
       setUpvotes(previousUpvotes);setDownvotes(previousDownvotes);setActorVotes(previousVotes);return;
     }
     const {data,error:countError}=await client.from('reactions').select('vote').eq('post_id',postId);
     if(countError)return;
     const confirmedUpvotes=(data??[]).filter(row=>Number(row.vote)!==-1).length;
     const confirmedDownvotes=(data??[]).filter(row=>Number(row.vote)===-1).length;
     setUpvotes(confirmedUpvotes);setDownvotes(confirmedDownvotes);
   });
 }

 const selectedVote=actorVotes[selectedActor]??0;
 return <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-3 text-sm text-muted">
   {showComments&&<Link href={`/posts/${postId}`} className="hover:text-gold">{commentCount} comments</Link>}
   {actors.length>0&&<>
     <button type="button" onClick={()=>castVote(1)} disabled={pending} aria-pressed={selectedVote===1} className={selectedVote===1?'text-gold':'hover:text-gold'}>👍 Upvote</button>
     <button type="button" onClick={()=>castVote(-1)} disabled={pending} aria-pressed={selectedVote===-1} className={selectedVote===-1?'text-gold':'hover:text-gold'}>👎 Downvote</button>
   </>}
   <span>👍 {upvotes}</span>
   <span>👎 {downvotes}</span>
   <span>Score {upvotes-downvotes}</span>
   <ShareLink path={`/posts/${postId}`}/>
   {actors.length>0&&<select value={selectedActor} onChange={e=>setSelectedActor(e.target.value)} aria-label="Vote as" className="max-w-[180px] rounded-lg border border-line bg-panel-raised px-2 py-1 text-ink">
     {actors.map(actor=><option key={actor.id} value={actor.id}>{actor.name}</option>)}
   </select>}
 </div>;
}
