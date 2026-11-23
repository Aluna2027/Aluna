import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { first340StatusLabel } from '@/lib/first340';
import { startFirst340, reapplyFirst340, withdrawFirst340 } from './actions';
import { First340WithdrawConfirmation } from '@/components/first340-withdraw-confirmation';

export default async function First340({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const params = await searchParams;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: applications, error } = await client.from('first340_applications')
    .select('id,application_version,status,submitted_at,updated_at')
    .eq('profile_id', user.id).order('application_version', { ascending: false });
  const latest = applications?.[0] ?? null;
  const active = applications?.find((application) => application.status !== 'withdrawn') ?? null;
  const { data: team } = latest?.status === 'selected'
    ? await client.from('first340_team_members').select('team_id,first340_teams(name)').eq('application_id', latest.id).maybeSingle()
    : { data: null };

  return <div className="space-y-6">
    <header><p className="deck-label">ALUNA · SPECIAL PROGRAM</p><h1 className="mt-2 text-4xl">The First 340</h1>
      <p className="mt-2 text-muted">A program within your existing Aluna account—not a separate user type and not a user limit.</p></header>
    {params.status === 'saved' && <p role="status" className="rounded-xl border border-line p-3 text-sm text-gold">Draft saved.</p>}
    {params.status === 'submitted' && <p role="status" className="rounded-xl border border-line p-3 text-sm text-gold">Your application has been submitted.</p>}
    {params.status === 'withdrawn' && <p role="status" className="rounded-xl border border-line p-3 text-sm text-gold">Your application was withdrawn. You can reapply with a new application version.</p>}
    {params.error && <p role="alert" className="rounded-xl border border-red-700 p-3 text-sm text-red-300">That application action could not be completed. Refresh and try again.</p>}
    {error && <p role="alert" className="text-red-300">Your application status could not be loaded.</p>}
    <Card title={latest ? `Application · ${first340StatusLabel(latest.status)} · v${latest.application_version}` : 'Join the program'}>
      {active ? <>
        <p>Your application remains connected to your Aluna profile.</p>
        {team && <p className="mt-3">Team: <span className="text-ink">{(team.first340_teams as unknown as { name: string })?.name}</span></p>}
        {active.status === 'draft' && <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/first-340/apply" className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Continue application</Link>
        </div>}
        {active.status !== 'draft' && !['selected','withdrawn'].includes(active.status) &&
          <div className="mt-4"><First340WithdrawConfirmation action={withdrawFirst340}/></div>}
        {active.status !== 'draft' && <p className="mt-3 text-sm">Selection is reviewed by authorized Aluna Super Admins. Fundraising activity informs review but never selects automatically.</p>}
      </> : latest?.status === 'withdrawn' ? <>
        <p>Your previous application remains available in your history. Reapplying creates a separate draft with your earlier answers copied for review.</p>
        <form action={reapplyFirst340} className="mt-5"><button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Reapply</button></form>
      </> : <form action={startFirst340}><button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Apply for The First 340</button></form>}
    </Card>
    {applications && applications.length > 0 && <Card title="Application history">
      <ul className="space-y-2">{applications.map((application) => <li key={application.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 text-sm">
        <span>Version {application.application_version} · {first340StatusLabel(application.status)}</span>
        <span className="text-muted">{application.submitted_at ? new Date(application.submitted_at).toLocaleString() : 'Not submitted'}</span>
      </li>)}</ul>
    </Card>}
    <div className="grid gap-4 sm:grid-cols-2"><Card title="My First 340 dashboard"><p>Profile · Team · Missions · Fundraising · Referral link · Donations · Contributions · Proofs · Messages · Impact</p></Card><Card title="Program structure"><p>Approximately 20 teams with flexible capacity. The system is not hard-coded to exactly 340 people.</p></Card></div>
  </div>;
}
