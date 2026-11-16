import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { ImpactView } from '@/components/impact-view';
import { ContributionHistory } from '@/components/contribution-history';
import { createClient } from '@/lib/supabase/server';
import { iconColors } from '@/lib/icon-colors';

export async function OrganizationImpact({actorId,subject='organization',project,basePath}:{
 actorId:string;subject?:'organization'|'profile';project?:string;basePath?:string;
}){
 const client=await createClient();
 const {data:contributions}=await client.from('contributions')
  .select('mission_id,community_id,missions(title),mesh_communities(name)')
  .eq('actor_id',actorId).limit(1000);
 const projects = new Map<string,string>();
 for(const c of contributions??[]){
  if(c.mission_id)projects.set('mission:'+c.mission_id,(c.missions as unknown as {title:string}|null)?.title ?? 'SDG Mission');
  else if(c.community_id)projects.set('community:'+c.community_id,(c.mesh_communities as unknown as {name:string}|null)?.name ?? 'Wi-Fi Mesh Community');
 }
 const selected=project&&projects.has(project)?project:undefined;
 const [kind,id]=selected?.split(':')??[];
 const scope={actorId,...(kind==='mission'?{missionId:id}:kind==='community'?{communityId:id}:{})};
 const base=basePath??(subject==='profile'?'/profile':'/organizations');
 return <section className="space-y-5" id="impact">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h2 className="flex items-center gap-3 text-lg font-semibold text-ink"><TrendingUp size={24} color={iconColors.impact}/>Impact</h2>
   <details className="relative">
    <summary className="cursor-pointer rounded-xl border border-line bg-panel px-4 py-2 text-sm text-gold">{selected?projects.get(selected):'All projects'} ▾</summary>
    <div className="absolute right-0 z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border border-line bg-panel p-2 shadow-xl">
     <Link className="block rounded-lg px-3 py-2 text-sm text-gold hover:bg-panel-raised" href={base+'?tab=impact'}>All projects</Link>
     {[...projects].sort((a,b)=>a[1].localeCompare(b[1])).map(([key,name])=><Link key={key} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-panel-raised" href={base+'?tab=impact&project='+encodeURIComponent(key)}>{name}</Link>)}
    </div>
   </details>
  </div>
  <ImpactView scope={scope} metricIconColor={iconColors.impact}/>
  <ContributionHistory actorId={actorId} missionId={kind==='mission'?id:undefined} communityId={kind==='community'?id:undefined} actorView/>
 </section>;
}
