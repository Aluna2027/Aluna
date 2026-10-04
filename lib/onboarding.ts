const roles=new Set(['builder','explorer','rebel','creator']);

export type OnboardingProfile={
 display_name?:string|null;
 first_name?:string|null;
 last_name?:string|null;
 aluna_role?:string|null;
 onboarded_at?:string|null;
};

function hasText(value:string|null|undefined){return typeof value==='string'&&value.trim().length>0;}

export function isOnboardingComplete(profile:OnboardingProfile|null|undefined){
 return !!profile
  &&hasText(profile.display_name)
  &&hasText(profile.first_name)
  &&hasText(profile.last_name)
  &&!!profile.aluna_role
  &&roles.has(profile.aluna_role)
  &&!!profile.onboarded_at;
}
