import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { First340Activity } from '@/components/first340-activity';
import { requireAlunaSuperAdmin } from '@/lib/aluna-admin';
import { first340Statuses, first340StatusLabel } from '@/lib/first340';
import { decideFirst340 } from '../../../first-340/actions';

const answerLabels = [
  ['motivation','Motivation'],['country','Country'],['languages','Languages'],['skills','Skills'],
  ['expertise','Expertise'],['relevant_experience','Relevant experience'],['availability','Availability'],
  ['preferred_role','Preferred role'],['travel_availability','Travel availability'],
  ['additional_information','Additional information'],['contact_email','Contact email'],
  ['phone_e164','International phone'],['phone_country_code','Phone country'],
] as const;

export default async function First340ApplicantDossier({params}:{params:Promise<{profileId:string}>}) {
  const { profileId } = await params;
  const { client } = await requireAlunaSuperAdmin();
  const [{ data: profile }, { data: applications, error: applicationError }] = await Promise.all([
    client.from('public_profiles').select('id,display_name,first_name,last_name').eq('id',profileId).maybeSingle(),
    client.from('first340_applications').select('*').eq('profile_id',profileId)
      .order('submitted_at',{ascending:false,nullsFirst:false}).order('application_version',{ascending:false}),
  ]);
  if (!applications?.length) notFound();
  const ids = applications.map((application) => application.id);
  const [{ data: audit }, { data: assignments }, { data: teams }] = await Promise.all([
    client.from('first340_audit').select('*').in('application_id',ids).order('created_at',{ascending:false}),
    client.from('first340_team_members').select('application_id,team_id,assigned_at,first340_teams(name)').in('application_id',ids),
    client.from('first340_teams').select('id,name,capacity').order('name'),
  ]);
  const name = profile?.display_name || [profile?.first_name,profile?.last_name].filter(Boolean).join(' ') || 'Applicant';
  return <div className="space-y-6">
    <Link href="/aluna-admin/first-340" className="text-sm text-gold">← All 340 applications</Link>
    <header><p className="deck-label">ALUNA · SUPER ADMIN · RESTRICTED DOSSIER</p><h1 className="mt-2 text-4xl">{name}</h1><p className="mt-2 break-all text-sm text-muted">Stable profile ID: {profileId}</p></header>
    {applicationError && <p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Some application details could not be loaded.</p>}
    <Card title="Application versions">
      <div className="space-y-5">{applications.map((application,index) => {
        const entries = (audit ?? []).filter((event) => event.application_id === application.id);
        const assignment = (assignments ?? []).find((entry) => entry.application_id === application.id);
        const teamName = (assignment?.first340_teams as unknown as {name:string}|null)?.name;
        return <article key={application.id} className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-ink">Application v{application.application_version} · {first340StatusLabel(application.status)}</h2>
              <p className="mt-1 text-sm text-muted">{application.submitted_at ? `Submitted ${new Date(application.submitted_at).toLocaleString()}` : 'Not submitted'} · Created {new Date(application.created_at).toLocaleString()} · Last activity {new Date(application.updated_at).toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted">Reviewed: {application.reviewed_at ? new Date(application.reviewed_at).toLocaleString() : '—'} · Selected: {application.selected_at ? new Date(application.selected_at).toLocaleString() : '—'}</p>
              <p className="mt-1 text-xs text-muted">Application ID: {application.id}</p>
              {teamName && <p className="mt-1 text-sm">Team: {teamName}</p>}
            </div>
            {application.status!=='draft'&&application.status!=='withdrawn'&&<form action={decideFirst340} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={application.id}/>
              <select aria-label="Application status" name="status" defaultValue={application.status} className="rounded-lg border border-line bg-panel-raised p-2">
                {first340Statuses.filter(([value])=>!['draft','submitted','withdrawn'].includes(value)).map(([value,label])=><option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Team assignment" name="team_id" defaultValue={assignment?.team_id ?? ''} className="rounded-lg border border-line bg-panel-raised p-2">
                <option value="">Keep current team</option>{teams?.map((team)=><option key={team.id} value={team.id}>{team.name} · capacity {team.capacity}</option>)}
              </select>
              <input name="note" maxLength={2000} placeholder="Review note" className="min-w-36 rounded-lg border border-line bg-panel-raised p-2"/>
              <button className="rounded-lg bg-gold px-3 py-2 font-semibold text-navy">Save decision</button>
            </form>}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">{answerLabels.map(([key,label])=>{
            const value = application[key];
            const display = Array.isArray(value) ? value.join(', ') : value || 'Not provided';
            return <div key={key} className="rounded-lg bg-panel-raised p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{display}</dd></div>;
          })}</dl>
          <details className="mt-4"><summary className="cursor-pointer text-sm text-gold">Audit history · {entries.length} events</summary>
            <ol className="mt-3 space-y-2">{entries.map((event)=><li key={event.id} className="rounded-lg border border-line p-3 text-sm">
              <p>{event.previous_status || 'New'} → {event.new_status || 'Updated'}</p><time className="text-xs text-muted">{new Date(event.created_at).toLocaleString()}</time>
              {(event.previous_team_id || event.new_team_id) && <p className="mt-1 text-xs text-muted">Team: {event.previous_team_id ?? '—'} → {event.new_team_id ?? '—'}</p>}
              {event.note && <p className="mt-1 whitespace-pre-wrap">{event.note}</p>}
            </li>)}{!entries.length&&<li className="text-sm text-muted">No audit entries.</li>}</ol>
          </details>
          {index===0&&<details className="mt-4"><summary className="cursor-pointer text-sm text-gold">Candidate activity</summary><First340Activity profileId={profileId}/></details>}
        </article>;
      })}</div>
    </Card>
  </div>;
}
