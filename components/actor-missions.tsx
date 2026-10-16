import { ProfileMissionCards } from '@/components/profile-directory-cards';
export async function ActorMissions({actorId}:{actorId:string}){
 return <ProfileMissionCards actorId={actorId}/>;
}
