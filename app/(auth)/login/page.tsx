import { signIn, signUp } from './actions';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; status?: string; next?: string;mode?:string }> }) {
  const params = await searchParams;
  const signup=params.mode==='signup';
  return <main className="min-h-screen grid place-items-center bg-navy p-5">
    <div className="glass w-full max-w-md rounded-3xl p-8 sm:p-10">
      <div className="text-3xl font-black tracking-[.2em]">ALUNA<span className="text-gold">.</span></div>
      <p className="mt-2 text-sm text-muted">GLOBAL NETWORK · People. Places. Possibility.</p>
      <h1 className="mt-10 text-3xl font-semibold">{signup?'Join Aluna':'Welcome to Aluna'}</h1>
      <p className="mt-2 text-muted">{signup?'Create your Aluna account. Your First 340 application is optional after joining.':'Sign in to enter the network.'}</p>
      {params.error && <p role="alert" className="mt-5 rounded-xl bg-red-950/50 p-3 text-sm text-red-200">{params.error === 'invalid' ? 'Check your email and password.' : 'Could not create your account. Check your details and try again.'}</p>}
      {params.status === 'verify' && <p role="status" className="mt-5 rounded-xl bg-panel-raised p-3 text-sm">Check your email to confirm your account.</p>}
      {params.status === 'password-updated' && <p role="status" className="mt-5 rounded-xl bg-panel-raised p-3 text-sm">Password updated. Please sign in again.</p>}
      <form className="mt-8 space-y-4">
        <input type="hidden" name="next" value={params.next??''}/>
        <label className="block text-sm font-medium">Email<input required type="email" name="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-line bg-panel p-3" /></label>
        <label className="block text-sm font-medium">Password<input required minLength={signup?12:6} type="password" name="password" autoComplete={signup?'new-password':'current-password'} className="mt-2 w-full rounded-xl border border-line bg-input p-3" /></label>
        <button formAction={signup?signUp:signIn} className="w-full rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">{signup?'Create account':'Sign in'}</button>
      </form>
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-gold"><a href={signup?'/login':'/login?mode=signup'}>{signup?'Already a member? Log in':'New here? Join Aluna'}</a><a href="/forgot-password">Forgot password?</a></div>
    </div>
  </main>;
}
