import { ProfileFundraisingCards } from '@/components/profile-directory-cards';
export async function ActorFundraising({actorId}:{actorId:string}){
 return <ProfileFundraisingCards actorId={actorId}/>;
}
