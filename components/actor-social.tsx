import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { actorDetails, ownedActors, relativeDate } from '@/lib/social';
import { ProfileSocialActionBar, type ProfileRelationOption } from '@/components/profile-social-action-bar';
import { Card } from '@/components/ui';

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
async function ActorPosts({actorId}:{actorId:string}) {const client=await createClient();const {data}=await client.from('posts').select('id,body,created_at').eq('actor_id',actorId).order('created_at',{ascending:false}).limit(20);return <Card title="Posts"><div className="space-y-4">{data?.map(post=><Link href={`/posts/${post.id}`} key={post.id} className="block border-b border-line pb-3 text-ink hover:text-gold"><span className="text-xs text-muted">{relativeDate(post.created_at)}</span><p className="mt-2 line-clamp-3 whitespace-pre-wrap">{post.body}</p></Link>)}{!data?.length&&<p>No posts yet.</p>}</div></Card>}
async function ActorRelations({actorId,section}:{actorId:string;section:Section}) {
 const client=await createClient();let ids:string[]=[];
 if(section==='Followers'||section==='Following') {const col=section==='Followers'?'followed_actor_id':'follower_actor_id';const {data}=await client.from('follows').select('follower_actor_id,followed_actor_id').eq(col,actorId).limit(100);ids=(data??[]).map(row=>section==='Followers'?row.follower_actor_id:row.followed_actor_id);}
 if(section==='Connections'){const {data}=await client.from('connections').select('actor_a,actor_b').eq('status','accepted').or(`actor_a.eq.${actorId},actor_b.eq.${actorId}`).limit(100);ids=(data??[]).map(row=>row.actor_a===actorId?row.actor_b:row.actor_a);}
 const details=await actorDetails(ids);return <Card title={section}><div className="space-y-3">{ids.map(id=>{const actor=details.get(id);return actor&&<Link key={id} href={actor.href} className="block rounded-xl border border-line p-3 text-ink hover:border-gold">{actor.name} <span className="text-xs text-muted">· {actor.kind}</span></Link>})}{!ids.length&&<p>No {section.toLowerCase()} yet.</p>}</div></Card>;
}
