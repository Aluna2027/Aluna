export type PostAudience = 'public' | 'followers' | 'members';

/** Context composers accept only Everyone or Members only. Invalid values fail closed. */
export function submittedPostAudience(value: FormDataEntryValue | null, contextual: boolean): PostAudience {
  if (contextual) return value === 'public' ? 'public' : 'members';
  return value === 'followers' ? 'followers' : 'public';
}

export function defaultPostAudience(contextual: boolean): PostAudience {
  return contextual ? 'members' : 'public';
}
