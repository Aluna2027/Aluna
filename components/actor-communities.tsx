import { ProfileCommunityCards } from '@/components/profile-directory-cards';
export async function ActorCommunities({actorId}:{actorId:string}){
 return <ProfileCommunityCards actorId={actorId}/>;
}
