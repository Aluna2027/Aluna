import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ownedActors } from '@/lib/social';
import { ProfileTabs } from '@/components/profile-tabs';

export async function SocialProfileTabs({base,tabs,active,actorId,tabsFirst=false,manage=false}:{base:string;tabs:readonly string[];active:string;actorId?:string;tabsFirst?:boolean;manage?:boolean}){
 if(!actorId)return <ProfileTabs base={base} tabs={tabs} active={active} manage={manage}/>;
 const client=await createClient();
 const [{count:followers},{count:following},{count:connections}]=await Promise.all([
  client.from('follows').select('follower_actor_id',{count:'exact',head:true}).eq('followed_actor_id',actorId),
  client.from('follows').select('followed_actor_id',{count:'exact',head:true}).eq('follower_actor_id',actorId),
  client.from('connections').select('actor_a',{count:'exact',head:true}).eq('status','accepted').or(`actor_a.eq.${actorId},actor_b.eq.${actorId}`)
 ]);
 const owned=await ownedActors(),isOwn=owned.some(a=>a.id===actorId);
 const {count:requests}=isOwn?await client.from('connections').select('actor_a',{count:'exact',head:true}).eq('status','pending').neq('requested_by',actorId).or(`actor_a.eq.${actorId},actor_b.eq.${actorId}`):{count:0};
 const pending=requests??0;
 const pendingNotice=isOwn&&pending>0?<Link scroll={false} href={`${base}?tab=connections`} className="flex items-center justify-between gap-3 rounded-xl border border-gold bg-panel p-4 text-gold hover:bg-panel-raised"><span className="font-medium">{pending} connection request{pending===1?'':'s'} awaiting your response</span><span aria-hidden>→</span></Link>:null;
 const tabsView=<ProfileTabs base={base} tabs={tabs} active={active} counts={{followers:followers??0,following:following??0,connections:connections??0}} manage={manage}/>;
 return <div className="space-y-3">{tabsFirst?<>{tabsView}{pendingNotice}</>:<>{pendingNotice}{tabsView}</>}</div>;
}
