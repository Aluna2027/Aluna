import { ContributionList } from '@/components/contribution-list';
export default async function ContributionsPage({searchParams}:{searchParams:Promise<{city?:string;actor?:string;mission?:string;community?:string;page?:string}>}) {
 const {city,actor,mission,community,page}=await searchParams;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const n=Math.max(0,Math.min(1000,Number.parseInt(page??'0',10)||0));
 return <div className="space-y-6"><header><p className="deck-label">ALUNA · IMPACT</p><h1 className="mt-2 text-4xl">Contributions</h1></header><ContributionList actorId={actor&&uuid.test(actor)?actor:undefined} missionId={mission&&uuid.test(mission)?mission:undefined} communityId={community&&uuid.test(community)?community:undefined} cityKey={city} page={n}/></div>;
}
