import { createClient } from '@/lib/supabase/server';
export type Actor = {id:string;name:string;kind:string;href:string};
export type FeedPost = {id:string;actor_id:string;body:string;visibility:string;repost_of_id:string|null;created_at:string;author_name:string;author_kind:string;reaction_count:number;comment_count:number;media_path?:string|null;media_type?:'image'|'video'|null;media_url?:string|null};

export async function ownedActors() {
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return [] as Actor[];
 const [{data:personal},{data:memberships}]=await Promise.all([
   client.from('actors').select('id,profile_id,profiles(display_name)').eq('profile_id',user.id),
   client.from('organization_members').select('organization_id,organizations(name,organization_type,removed_at)').eq('profile_id',user.id).eq('member_role','admin'),
 ]);
 const activeMemberships=(memberships??[]).filter(m=>!(m.organizations as unknown as {removed_at:string|null}|null)?.removed_at);
 const orgIds=activeMemberships.map(m=>m.organization_id);
 const {data:orgActors}=orgIds.length?await client.from('actors').select('id,organization_id').in('organization_id',orgIds):{data:[]};
 const names=new Map(activeMemberships.map(m=>[m.organization_id,m.organizations as unknown as {name:string;organization_type:string;removed_at:string|null}|null]));
 return [...(personal??[]).map(a=>({id:a.id,name:(a.profiles as unknown as {display_name:string}|null)?.display_name||'You',kind:'user',href:`/people/${user.id}`})),...(orgActors??[]).map(a=>({id:a.id,name:names.get(a.organization_id)?.name||'Organization',kind:names.get(a.organization_id)?.organization_type||'organization',href:`/organizations/${a.organization_id}`}))];
}

export async function actorDetails(ids:string[]):Promise<Map<string,Actor>> {
 const result=new Map<string,Actor>();if(!ids.length)return result;
 const client=await createClient();const {data}=await client.from('actors').select('id,profile_id,organization_id,profiles(display_name),organizations(name,organization_type)').in('id',[...new Set(ids)]);
 for(const a of data??[]){const p=a.profiles as unknown as {display_name:string}|null;const o=a.organizations as unknown as {name:string;organization_type:string}|null;result.set(a.id,{id:a.id,name:p?.display_name||o?.name||'Member',kind:p?'user':o?.organization_type||'organization',href:p?`/people/${a.profile_id}`:`/organizations/${a.organization_id}`});}
 return result;
}

export async function attachPostMedia(posts:FeedPost[]) {
 const paths=[...new Set(posts.map(p=>p.media_path).filter((p):p is string=>!!p))];
 if(!paths.length)return posts;
 const client=await createClient();const {data}=await client.storage.from('post-media').createSignedUrls(paths,3600);
 const urls=new Map((data??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]));
 return posts.map(post=>({...post,media_url:post.media_path?urls.get(post.media_path)??null:null}));
}

export function relativeDate(value:string) {return new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
