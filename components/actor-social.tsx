import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, ownedActors, relativeDate } from '@/lib/social';
import { ProfileSocialActionBar, type ProfileRelationOption } from '@/components/profile-social-action-bar';
import { Card } from '@/components/ui';
import { ConnectionRequestActions } from '@/components/connection-request-actions';

type Section='Posts'|'Followers'|'Following'|'Connections';
export async function ActorSocial({actorId,section}:{actorId:string;section:string}) {
 return section==='Posts'?<ActorPosts actorId={actorId}/>:['Followers','Following','Connections'].includes(section)?<ActorRelations actorId={actorId} section={section as Section}/>:null;
}
export async function ActorSocialActions({actorId,profilePath}:{actorId:string;profilePath:string}) {
 const client=await createClient(),owned=await ownedActors();
 if(owned.some(a=>a.id===actorId)||!owned.length)return null;
 const options=await Promise.all(owned.map(async actor=>{
  const [actor_a,actor_b]=[actor.id,actorId].sort();
  const [follow,connection]=await Promise.all([
   client.from('follows').select('follower_actor_id').eq('follower_actor_id',actor.id).eq('followed_actor_id',actorId).maybeSingle(),
   client.from('connections').select('actor_a,actor_b,requested_by,status').eq('actor_a',actor_a).eq('actor_b',actor_b).maybeSingle()
  ]);
  return {actor,follow,connection};
 }));
 if(options.some(o=>o.follow.error||o.connection.error))return <p role="alert" className="text-red-300">Could not load profile relationships.</p>;
 return <ProfileSocialActionBar targetActorId={actorId} profilePath={profilePath} options={options.map(o=>({id:o.actor.id,name:o.actor.name,following:!!o.follow.data,connection:o.connection.data}))}/>;
}
async function ActorPosts({actorId}:{actorId:string}){
 const client=await createClient();
 const {data}=await client.from('posts').select('id,body,created_at,media_path,media_type').eq('actor_id',actorId).order('created_at',{ascending:false}).limit(20);
 const paths=(data??[]).map(p=>p.media_path).filter((p):p is string=>!!p);
 const {data:signed}=paths.length?await client.storage.from('post-media').createSignedUrls(paths,3600):{data:[]};
 const urls=new Map((signed??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]));
 return <Card title="Posts"><div className="space-y-5">{data?.map(post=>{const url=post.media_path?urls.get(post.media_path):null;return <article key={post.id} className="border-b border-line pb-4">
  <Link href={`/posts/${post.id}`} className="block text-xs text-gold hover:underline">{relativeDate(post.created_at)}</Link>
  {post.body&&<p className="mt-2 whitespace-pre-wrap break-words text-ink">{post.body}</p>}
  {url&&post.media_type==='image'&&<img src={url} alt="Post image" className="mt-3 max-h-[520px] w-full rounded-xl border border-line object-contain"/>}
  {url&&post.media_type==='video'&&<video src={url} controls preload="metadata" className="mt-3 max-h-[520px] w-full rounded-xl border border-line"/>}
  <Link href={`/posts/${post.id}`} className="mt-3 inline-block text-sm text-gold hover:underline">View post →</Link>
 </article>;})}{!data?.length&&<p>No posts yet.</p>}</div></Card>;
}
async function ActorRelations({actorId,section}:{actorId:string;section:Section}){
 const client=await createClient();
 const owned=await ownedActors(),isOwn=owned.some(a=>a.id===actorId);
 if(section!=='Connections'){
  const col=section==='Followers'?'followed_actor_id':'follower_actor_id';
  const {data}=await client.from('follows').select('follower_actor_id,followed_actor_id').eq(col,actorId).limit(100);
  const ids=(data??[]).map(row=>section==='Followers'?row.follower_actor_id:row.followed_actor_id);
  const details=await actorDetails(ids);
  return <Card title={section}><div className="space-y-3">{ids.map(id=>{const actor=details.get(id);return actor&&<Link key={id} href={actor.href} className="block rounded-xl border border-line p-3 text-ink hover:border-gold">{actor.name} <span className="text-xs text-muted">· {actor.kind}</span></Link>})}{!ids.length&&<p>No {section.toLowerCase()} yet.</p>}</div></Card>;
 }
 const {data:all}=await client.from('connections').select('actor_a,actor_b,requested_by,status,created_at').or(`actor_a.eq.${actorId},actor_b.eq.${actorId}`).order('created_at',{ascending:false}).limit(100);
 const incoming=isOwn?(all??[]).filter(c=>c.status==='pending'&&c.requested_by!==actorId):[];
 const sent=isOwn?(all??[]).filter(c=>c.status==='pending'&&c.requested_by===actorId):[];
 const accepted=(all??[]).filter(c=>c.status==='accepted');
 const other=(c:{actor_a:string;actor_b:string})=>c.actor_a===actorId?c.actor_b:c.actor_a;
 const names=await actorDetails([...incoming,...sent,...accepted].map(other));
 const member=(id:string)=>{const actor=names.get(id);return actor?<Link href={actor.href} className="font-medium text-gold hover:underline">{actor.name}</Link>:<span>Member</span>;};
 return <div className="space-y-5">
  {isOwn&&<Card title={`Connection requests (${incoming.length})`}><div className="space-y-3">{incoming.map(c=><div key={other(c)} className="space-y-3 rounded-xl border border-line bg-panel-raised p-4">{member(other(c))}<p className="text-sm text-muted">Wants to connect with you</p><ConnectionRequestActions actorId={actorId} actorA={c.actor_a} actorB={c.actor_b}/></div>)}{!incoming.length&&<p>No pending connection requests.</p>}</div></Card>}
  {isOwn&&<Card title={`Sent requests (${sent.length})`}><div className="space-y-3">{sent.map(c=><div key={other(c)} className="rounded-xl border border-line p-3">{member(other(c))} <span className="text-xs text-muted">· Pending</span></div>)}{!sent.length&&<p>No sent requests pending.</p>}</div></Card>}
  <Card title={`My Connections (${accepted.length})`}><div className="space-y-3">{accepted.map(c=><div key={other(c)} className="flex items-center gap-2 rounded-xl border border-line p-3"><span aria-label="Connected" style={{color:"#26E7D4"}}>✓</span>{member(other(c))}</div>)}{!accepted.length&&<p>No connections yet.</p>}</div></Card>
 </div>;
}
