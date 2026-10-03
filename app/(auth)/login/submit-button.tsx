'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ signup }: { signup: boolean }) {
  const { pending } = useFormStatus();

  return <button
    type="submit"
    disabled={pending}
    aria-disabled={pending}
    className="w-full rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-70"
  >
    {pending ? (signup ? 'CREATING ACCOUNT...' : 'SIGNING IN...') : (signup ? 'Create account' : 'Sign in')}
  </button>;
}
