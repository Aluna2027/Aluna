import { signIn, signUp } from './actions';
import { SubmitButton } from './submit-button';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; status?: string; next?: string;mode?:string }> }) {
  const params = await searchParams;
  const signup=params.mode==='signup';

  const errorMessage = params.error === 'invalid'
    ? 'Check your email and password.'
    : params.error === 'validation'
      ? 'Enter a valid email address and use a password of at least 12 characters.'
      : params.error === 'signup'
        ? 'Something went wrong while creating your account. Please try again.'
        : null;

  return <main className="min-h-screen grid place-items-center bg-navy p-5">
    <div className="glass w-full max-w-md rounded-3xl p-8 sm:p-10">
      <div className="text-3xl font-black tracking-[.2em]">ALUNA<span className="text-gold">.</span></div>
      <p className="mt-2 text-sm text-muted">GLOBAL NETWORK · People. Places. Possibility.</p>
      <h1 className="mt-10 text-3xl font-semibold">{signup?'Join Aluna':'Welcome to Aluna'}</h1>
      <p className="mt-2 text-muted">{signup?'Create your Aluna account. Your First 340 application is optional after joining.':'Sign in to enter the network.'}</p>

      {errorMessage && <div role="alert" className="mt-5 rounded-xl bg-red-950/50 p-3 text-sm text-red-200">
        <strong className="block">{params.error === 'validation' ? 'CHECK YOUR DETAILS' : params.error === 'signup' ? 'COULD NOT CREATE ACCOUNT' : 'SIGN IN FAILED'}</strong>
        <span className="mt-1 block">{errorMessage}</span>
      </div>}

      {params.status === 'verify' && <div role="status" className="mt-5 rounded-xl bg-panel-raised p-3 text-sm">
        <strong className="block text-gold">CHECK YOUR EMAIL</strong>
        <span className="mt-1 block">Your Aluna account has been created.</span>
        <span className="mt-1 block">We sent you a verification link. Confirm your email address to activate your account.</span>
        <span className="mt-1 block text-muted">Check your spam or junk folder if you don&apos;t see the email.</span>
      </div>}

      {params.status === 'verification-recent' && <div role="status" className="mt-5 rounded-xl bg-panel-raised p-3 text-sm">
        <strong className="block text-gold">CHECK YOUR EMAIL</strong>
        <span className="mt-1 block">A verification email was sent recently.</span>
        <span className="mt-1 block">Check your inbox and spam folder. If you need another email, wait about a minute before trying again.</span>
      </div>}

      {params.status === 'confirmation-link' && <div role="status" className="mt-5 rounded-xl bg-panel-raised p-3 text-sm">
        <strong className="block text-gold">EMAIL CONFIRMATION</strong>
        <span className="mt-1 block">Your confirmation link was processed.</span>
        <span className="mt-1 block">If your email has been confirmed, sign in below to continue. If the link expired or was already used, request a new confirmation email.</span>
      </div>}

      {params.status === 'password-updated' && <p role="status" className="mt-5 rounded-xl bg-panel-raised p-3 text-sm">Password updated. Please sign in again.</p>}

      <form action={signup?signUp:signIn} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={params.next??''}/>
        <label className="block text-sm font-medium">Email<input required type="email" name="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-line bg-panel p-3" /></label>
        <label className="block text-sm font-medium">Password<input required minLength={signup?12:6} maxLength={signup?128:undefined} type="password" name="password" autoComplete={signup?'new-password':'current-password'} className="mt-2 w-full rounded-xl border border-line bg-input p-3" />{signup && <span className="mt-2 block text-xs text-muted">Use at least 12 characters.</span>}</label>
        <SubmitButton signup={signup}/>
      </form>

      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-gold"><a href={signup?'/login':'/login?mode=signup'}>{signup?'Already a member? Log in':'New here? Join Aluna'}</a><a href="/forgot-password">Forgot password?</a></div>
    </div>
  </main>;
}
