const roles=new Set(['builder','explorer','rebel','creator']);

export type OnboardingProfile={
 display_name?:string|null;
 first_name?:string|null;
 last_name?:string|null;
 aluna_role?:string|null;
 onboarded_at?:string|null;
 demographics_required?:boolean|null;
 date_of_birth?:string|null;
 gender?:string|null;
};

function hasText(value:string|null|undefined){return typeof value==='string'&&value.trim().length>0;}

export function isOnboardingComplete(profile:OnboardingProfile|null|undefined){
 const coreComplete=!!profile
  &&hasText(profile.display_name)
  &&hasText(profile.first_name)
  &&hasText(profile.last_name)
  &&!!profile.aluna_role
  &&roles.has(profile.aluna_role)
  &&!!profile.onboarded_at;
 // Existing profiles are grandfathered by the migration because these fields
 // were not available when they completed onboarding. New profiles are marked
 // demographics_required=true and must have both fields before entering the app.
 const demographicsComplete=!profile?.demographics_required||(
  hasText(profile.date_of_birth)
  &&!!profile.gender
  &&['male','female','prefer_not_to_say'].includes(profile.gender)
 );
 return coreComplete&&demographicsComplete;
}
