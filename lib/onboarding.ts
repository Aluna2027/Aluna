import type { createClient } from '@/lib/supabase/server';

const roles=new Set(['builder','explorer','rebel','creator']);
const onboardingProfileFields='id,display_name,first_name,last_name,aluna_role,onboarded_at,date_of_birth,gender';

export type OnboardingProfile={
 id?:string;
 display_name?:string|null;
 first_name?:string|null;
 last_name?:string|null;
 aluna_role?:string|null;
 onboarded_at?:string|null;
 demographics_required?:boolean|null;
 date_of_birth?:string|null;
 gender?:string|null;
};

/**
 * Read the current user's gate fields across a staggered app/schema rollout.
 * Older Demo databases do not yet have demographics_required; retry only for
 * that missing-column error. v4 and the server action still require DOB/gender
 * before a new onboarding can be completed.
 */
export async function readOnboardingProfile(
 client:Awaited<ReturnType<typeof createClient>>,
 userId:string
){
 const read=(withDemographicsFlag:boolean)=>client.from('profiles')
  .select(withDemographicsFlag?onboardingProfileFields+',demographics_required':onboardingProfileFields)
  .eq('id',userId).maybeSingle();
 const current=await read(true);
 if(!current.error)return current;
 const missingFlagColumn=/(?:column .*demographics_required.*does not exist|could not find .*demographics_required.*column|schema cache.*demographics_required)/i.test(current.error.message);
 if(!missingFlagColumn)return current;
 const legacy=await read(false);
 return {
  ...legacy,
  data:legacy.data?{...legacy.data,demographics_required:false}:null
 };
}

function hasText(value:string|null|undefined){return typeof value==='string'&&value.trim().length>0;}

export function isOnboardingComplete(profile:OnboardingProfile|null|undefined){
 const coreComplete=!!profile
  &&hasText(profile.display_name)
  &&hasText(profile.first_name)
  &&hasText(profile.last_name)
  &&!!profile.aluna_role
  &&roles.has(profile.aluna_role)
  &&!!profile.onboarded_at;
 // Existing profiles are grandfathered because these fields were not
 // required when they completed onboarding. New profiles are marked
 // demographics_required=true and must have both fields before entering the app.
 const demographicsComplete=!profile?.demographics_required||(
  hasText(profile.date_of_birth)
  &&!!profile.gender
  &&['male','female','prefer_not_to_say'].includes(profile.gender)
 );
 return coreComplete&&demographicsComplete;
}
