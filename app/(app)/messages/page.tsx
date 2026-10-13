import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, ownedActors, relativeDate } from '@/lib/social';
import { MessageThread } from '@/components/message-thread';

export default async function Messages({searchParams}:{searchParams:Promise<{to?:string;conversation?:string;error?:string}>}) {
 const {to,conversation,error}=await searchParams;const actors=await ownedActors();const client=await createClient();const ids=actors.map(a=>a.id);
 const {data:threads}=ids.length?await client.from('conversations').select('id,actor_a,actor_b,created_at').or(`actor_a.in.(${ids.join(',')}),actor_b.in.(${ids.join(',')})`).order('created_at',{ascending:false}).limit(50):{data:[]};
 const selected=threads?.find(t=>t.id===conversation)??(conversation?(await client.from('conversations').select('id,actor_a,actor_b,created_at').eq('id',conversation).maybeSingle()).data:null);const otherId=selected?(ids.includes(selected.actor_a)?selected.actor_b:selected.actor_a):to;
 const people=await actorDetails([...(threads??[]).flatMap(t=>[t.actor_a,t.actor_b]),...(otherId?[otherId]:[])]);
 const {data:recent}=selected?await client.from('direct_messages').select('id,sender_actor_id,body,created_at,media_path,media_type').eq('conversation_id',selected.id).order('created_at',{ascending:false}).limit(100):{data:[]};
 const paths=[...new Set((recent??[]).map(m=>m.media_path).filter((p):p is string=>!!p))];const {data:signed}=paths.length?await client.storage.from('message-media').createSignedUrls(paths,3600):{data:[]};
 const mediaUrls=new Map((signed??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]));
 const sender=selected?actors.find(a=>a.id===selected.actor_a||a.id===selected.actor_b):actors[0];
 const recipient=otherId?people.get(otherId):null;
 return <div className="space-y-6"><div><p className="deck-label">PRIVATE CONVERSATIONS</p><h1 className="mt-2 text-4xl">Messages</h1><p className="mt-2 text-sm text-muted">Only conversation participants can read messages.</p></div>{error&&<p role="alert" className="text-amber-300">{error==='upload'?'Could not upload that photo or video.':'Could not send the message. Check the recipient and try again.'}</p>}
 <div className="grid gap-5 lg:grid-cols-[260px_1fr]"><aside className="glass rounded-2xl p-4"><h2 className="mb-4 text-lg">Conversations</h2><div className="space-y-2">{threads?.map(t=>{const peer=people.get(ids.includes(t.actor_a)?t.actor_b:t.actor_a);return <Link key={t.id} href={`/messages?conversation=${t.id}`} className={`block rounded-lg p-3 text-sm ${selected?.id===t.id?'bg-panel-raised text-gold':'text-ink hover:bg-panel-raised'}`}>{peer?.name||'Member'}</Link>})}{!threads?.length&&<p className="text-sm text-muted">No conversations yet. Open a profile and choose Message.</p>}</div></aside>
 <section className="glass min-h-80 rounded-2xl p-5"><h2 className="text-xl">{recipient?.name||'Select a conversation'}</h2>
 {recipient&&sender&&<MessageThread key={recipient.id} recipientId={recipient.id} recipientName={recipient.name} conversationId={selected?.id} senderOptions={actors.filter(a=>a.id!==recipient.id)} senders={[...actors,...people.values()]} initialMessages={[...(recent??[])].reverse().map(m=>({id:m.id,sender_actor_id:m.sender_actor_id,body:m.body,created_at:m.created_at,media_type:m.media_type,media_url:m.media_path?mediaUrls.get(m.media_path)??null:null}))}/>}
 </section></div></div>;
}
