'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, MessageCircle, UserPlus } from 'lucide-react';
import { requestConnection, respondConnection, toggleFollow } from '@/app/(app)/feed/actions';

export type ProfileRelationOption = {
 id: string;
 name: string;
 following: boolean;
 connection: { actor_a:string; actor_b:string; requested_by:string; status:string } | null;
};

export function ProfileSocialActionBar({targetActorId,returnTo,options}:{targetActorId:string;returnTo:string;options:ProfileRelationOption[]}) {
 const [selectedId,setSelectedId]=useState(options[0]?.id??'');
 const selected=options.find(option=>option.id===selectedId)??options[0];
 if(!selected)return null;
 const connection=selected.connection;
 return <section aria-label="Profile actions" className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-4 text-sm">
  {options.length>1&&<label className="flex items-center gap-2 text-muted"><span>Act as</span><select aria-label="Act as" value={selected.id} onChange={event=>setSelectedId(event.target.value)} className="max-w-56 rounded-lg border border-line bg-panel-raised px-3 py-2 text-ink">{options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
  <form action={toggleFollow}>
   <input type="hidden" name="actor_id" value={selected.id}/><input type="hidden" name="target_actor_id" value={targetActorId}/><input type="hidden" name="return_to" value={returnTo}/>
   <button type="submit" aria-label={selected.following?'Unfollow this profile':'Follow this profile'} title={selected.following?'Unfollow this profile':'Follow this profile'} className="inline-flex items-center gap-2 rounded-lg border border-gold px-4 py-2 font-medium text-gold hover:bg-gold/10">{selected.following?<Check size={16}/>:<UserPlus size={16}/>} {selected.following?'Following':'Follow'}</button>
  </form>
  {connection?.status==='accepted'
   ?<span className="inline-flex items-center gap-2 rounded-lg border border-line bg-nav-active px-4 py-2 font-medium text-ink"><Check size={16} className="text-turquoise"/>Connected</span>
   :connection?.status==='pending'
    ?connection.requested_by===selected.id
      ?<span className="rounded-lg border border-line px-4 py-2 text-muted">Request pending</span>
      :<form action={respondConnection} className="flex flex-wrap gap-2">
       <input type="hidden" name="actor_a" value={connection.actor_a}/><input type="hidden" name="actor_b" value={connection.actor_b}/><input type="hidden" name="return_to" value={returnTo}/>
       <button type="submit" name="status" value="accepted" className="rounded-lg border border-gold px-4 py-2 text-gold hover:bg-gold/10">Accept</button>
       <button type="submit" name="status" value="declined" className="rounded-lg border border-line px-4 py-2 text-muted hover:bg-panel-raised">Decline</button>
      </form>
    :connection?.status==='declined'
     ?<span className="rounded-lg border border-line px-4 py-2 text-muted">Request declined</span>
     :<form action={requestConnection}>
      <input type="hidden" name="actor_id" value={selected.id}/><input type="hidden" name="target_actor_id" value={targetActorId}/><input type="hidden" name="return_to" value={returnTo}/>
      <button type="submit" className="rounded-lg border border-line px-4 py-2 font-medium text-ink hover:bg-panel-raised">Connect</button>
     </form>}
  <Link href={`/messages?to=${targetActorId}`} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-navy hover:opacity-90"><MessageCircle size={16}/>Message</Link>
 </section>;
}
