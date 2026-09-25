import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, ownedActors, relativeDate } from '@/lib/social';
import { Card, Placeholder } from '@/components/ui';
import { requestConnection, respondConnection, toggleFollow } from '@/app/(app)/feed/actions';

type Section='Posts'|'Followers'|'Following'|'Connections';
export async function ActorSocial({actorId,section,returnTo}:{actorId:string;section:string;returnTo:string}) {
 const client=await createClient();const owned=await ownedActors();const other=owned.filter(a=>a.id!==actorId);
 const {data:follows}=await client.from('follows').select('follower_actor_id,followed_actor_id').eq('followed_actor_id',actorId).limit(1);
 const currentFollow=owned.length?await client.from('follows').select('follower_actor_id').eq('followed_actor_id',actorId).in('follower_actor_id',owned.map(a=>a.id)).limit(1):{data:[]};
 const {data:connection}=owned.length?await client.from('connections').select('actor_a,actor_b,requested_by,status').or(`actor_a.eq.${actorId},actor_b.eq.${actorId}`).limit(100):{data:[]};
 const ourConnection=(connection??[]).find(c=>owned.some(a=>a.id===c.actor_a||a.id===c.actor_b));
 return <div className="space-y-5"><div className="flex flex-wrap items-center gap-3 text-sm text-muted"><span>{follows?.length? 'Followers available below':'Follow this profile for updates'}</span>{other.length>0&&<form action={toggleFollow} className="flex gap-2"><input type="hidden" name="target_actor_id" value={actorId}/><input type="hidden" name="return_to" value={returnTo}/><select name="actor_id" aria-label="Follow as" className="rounded-lg border border-line bg-panel-raised p-2">{other.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="rounded-lg border border-gold px-3 py-2 text-gold">{currentFollow.data?.length?'Follow / Unfollow':'Follow'}</button></form>}
 {other.length>0&&!ourConnection&&<form action={requestConnection}><input type="hidden" name="target_actor_id" value={actorId}/><input type="hidden" name="actor_id" value={other[0].id}/><input type="hidden" name="return_to" value={returnTo}/><button className="rounded-lg border border-line px-3 py-2 text-ink">Connect</button></form>}
 {ourConnection?.status==='pending'&&<span>Connection pending</span>}{ourConnection?.status==='accepted'&&<span>Connected</span>}
 {ourConnection?.status==='pending'&&owned.some(a=>a.id!==ourConnection.requested_by&&(a.id===ourConnection.actor_a||a.id===ourConnection.actor_b))&&<form action={respondConnection} className="flex gap-2"><input type="hidden" name="actor_a" value={ourConnection.actor_a}/><input type="hidden" name="actor_b" value={ourConnection.actor_b}/><input type="hidden" name="return_to" value={returnTo}/><button name="status" value="accepted" className="text-gold">Accept</button><button name="status" value="declined">Decline</button></form>}
 {other.length>0&&<Link href={`/messages?to=${actorId}`} className="rounded-lg border border-line px-3 py-2 text-gold">Message</Link>}</div>
 {section==='About'?null:section==='Posts'?<ActorPosts actorId={actorId}/>:['Followers','Following','Connections'].includes(section)?<ActorRelations actorId={actorId} section={section as Section}/>:<Placeholder title={section} description="This part of the profile is coming soon."/>}
 </div>;
}
async function ActorPosts({actorId}:{actorId:string}) {const client=await createClient();const {data}=await client.from('posts').select('id,body,created_at').eq('actor_id',actorId).order('created_at',{ascending:false}).limit(20);return <Card title="Posts"><div className="space-y-4">{data?.map(post=><Link href={`/posts/${post.id}`} key={post.id} className="block border-b border-line pb-3 text-ink hover:text-gold"><span className="text-xs text-muted">{relativeDate(post.created_at)}</span><p className="mt-2 line-clamp-3 whitespace-pre-wrap">{post.body}</p></Link>)}{!data?.length&&<p>No posts yet.</p>}</div></Card>}
async function ActorRelations({actorId,section}:{actorId:string;section:Section}) {
 const client=await createClient();let ids:string[]=[];
 if(section==='Followers'||section==='Following') {const col=section==='Followers'?'followed_actor_id':'follower_actor_id';const {data}=await client.from('follows').select('follower_actor_id,followed_actor_id').eq(col,actorId).limit(100);ids=(data??[]).map(row=>section==='Followers'?row.follower_actor_id:row.followed_actor_id);}
 if(section==='Connections'){const {data}=await client.from('connections').select('actor_a,actor_b').eq('status','accepted').or(`actor_a.eq.${actorId},actor_b.eq.${actorId}`).limit(100);ids=(data??[]).map(row=>row.actor_a===actorId?row.actor_b:row.actor_a);}
 const details=await actorDetails(ids);return <Card title={section}><div className="space-y-3">{ids.map(id=>{const actor=details.get(id);return actor&&<Link key={id} href={actor.href} className="block rounded-xl border border-line p-3 text-ink hover:border-gold">{actor.name} <span className="text-xs text-muted">· {actor.kind}</span></Link>})}{!ids.length&&<p>No {section.toLowerCase()} yet.</p>}</div></Card>;
}
