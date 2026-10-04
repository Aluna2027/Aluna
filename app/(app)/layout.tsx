import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/shell';

export default async function AppLayout({ children }: {children:React.ReactNode}) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await client
    .from('profiles')
    .select('id,display_name,onboarded_at,aluna_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.id !== user.id) {
    await client.auth.signOut({ scope:'local' });
    redirect('/login?error=session');
  }

  if (!profile.onboarded_at || !profile.aluna_role) redirect('/onboarding');

  return <Shell name={profile.display_name || user.email?.split('@')[0] || 'member'}>{children}</Shell>;
}
