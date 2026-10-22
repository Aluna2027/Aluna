import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { deleteOrganizationRelationship } from '@/app/(app)/organizations/membership-actions';
import { RelationshipEditor } from '@/components/organization-relationship-editor';

export async function OrganizationRelationshipCards({organizationId,isAdmin,managing}:{organizationId:string;isAdmin:boolean;managing:boolean}) {
 const client=await createClient();
 const {data:rows,error}=await client.from('organization_relationships').select('id,name,kind,organization_relationship_actors(actor_id)').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);
 const actorIds=[...new Set((rows??[]).flatMap(r=>((r.organization_relationship_actors as unknown as {actor_id:string}[])??[]).map(a=>a.actor_id)))];
 const {data:actors}=actorIds.length?await client.from('actors').select('id,profile_id,organization_id,organizations(name)').in('id',actorIds):{data:[]};
 const profileIds=[...new Set((actors??[]).map(a=>a.profile_id).filter((id):id is string=>!!id))];
 const {data:profiles}=profileIds.length?await client.from('public_profiles').select('id,display_name').in('id',profileIds):{data:[]};
 const profileNames=new Map((profiles??[]).map(p=>[p.id,p.display_name]));
 const names=new Map((actors??[]).map(a=>[a.id,{
  id:a.id,name:(a.profile_id?profileNames.get(a.profile_id):null)||(a.organizations as unknown as {name:string}|null)?.name||'Participant',
  kind:(a.profile_id?'Person':'Organization') as 'Person'|'Organization'
 }]));
 const categories=[{kind:'partnership' as const,title:'Partnerships'},{kind:'sponsorship' as const,title:'Sponsorships'}];
 return <section className="grid gap-4 md:grid-cols-2">{categories.map(category=><Card key={category.kind} title={category.title}>
  {error&&<p role="alert" className="text-red-300">Relationships unavailable until the organization migration is applied.</p>}
  <div className="space-y-4">{rows?.filter(r=>r.kind===category.kind).map(r=>{
   const people=((r.organization_relationship_actors as unknown as {actor_id:string}[])??[]).map(a=>names.get(a.actor_id)).filter((x):x is NonNullable<typeof x>=>!!x);
   return <div key={r.id} className="rounded-xl border border-line p-3"><h3 className="font-semibold">{r.name}</h3><p className="mt-2 text-sm text-muted">{people.map(x=>x.name).join(', ')||'No participants listed'}</p>
    {isAdmin&&managing&&<div className="mt-3 flex flex-wrap items-center gap-3"><RelationshipEditor organizationId={organizationId} kind={category.kind} existing={{id:r.id,name:r.name,participants:people}}/><form action={deleteOrganizationRelationship}><input type="hidden" name="organization_id" value={organizationId}/><input type="hidden" name="id" value={r.id}/><button className="text-sm text-red-300">Delete</button></form></div>}
   </div>
  })}</div>
  {isAdmin&&managing&&!error&&<RelationshipEditor organizationId={organizationId} kind={category.kind}/>}
  {!error&&!rows?.some(r=>r.kind===category.kind)&&<p className="mt-3 text-sm text-muted">No {category.title.toLowerCase()} yet.</p>}
 </Card>)}</section>;
}
