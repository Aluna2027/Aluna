import Link from 'next/link';
import { Card } from '@/components/ui';
import { requireAlunaSuperAdmin } from '@/lib/aluna-admin';
import { summarizeFirst340Roster, type First340Team } from '@/lib/first340-teams';

type TeamMember = { team_id: string; application_id: string; assigned_at: string };
type Application = { id: string; profile_id: string; application_version: number; status: string };
type Profile = { id: string; display_name: string | null; first_name: string | null; last_name: string | null };

export default async function First340TeamsPage() {
  const { client } = await requireAlunaSuperAdmin();
  const [{ data: teamRows, error: teamsError }, { data: membershipRows, error: membershipError }] = await Promise.all([
    client.from('first340_teams').select('id,name,capacity').order('name'),
    client.from('first340_team_members').select('team_id,application_id,assigned_at').order('assigned_at'),
  ]);
  const teams = (teamRows ?? []) as First340Team[];
  const memberships = (membershipRows ?? []) as TeamMember[];
  const applicationIds = [...new Set(memberships.map((row) => row.application_id))];
  const { data: applicationRows, error: applicationsError } = applicationIds.length
    ? await client.from('first340_applications').select('id,profile_id,application_version,status').in('id', applicationIds)
    : { data: [], error: null };
  const applications = (applicationRows ?? []) as Application[];
  const selectedApplications = applications.filter((application) => application.status === 'selected');
  const profileIds = [...new Set(selectedApplications.map((application) => application.profile_id))];
  const { data: profileRows, error: profilesError } = profileIds.length
    ? await client.from('public_profiles').select('id,display_name,first_name,last_name').in('id', profileIds)
    : { data: [], error: null };
  const profiles = (profileRows ?? []) as Profile[];
  const summary = summarizeFirst340Roster(teams, memberships.map((row) => row.team_id));
  const applicationById = new Map(selectedApplications.map((application) => [application.id, application]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const errors = teamsError || membershipError || applicationsError || profilesError;

  return <div className="space-y-6">
    <header>
      <p className="deck-label">ALUNA · SUPER ADMIN · RESTRICTED</p>
      <h1 className="mt-2 text-4xl">First 340 Teams</h1>
      <p className="mt-2 text-muted">Fixed cohort roster · 20 teams · 17 places per team.</p>
    </header>
    <Link href="/aluna-admin/first-340" className="text-sm text-gold">← Applications</Link>
    {errors && <p role="alert" className="rounded-xl border border-red-700 p-3 text-sm text-red-300">Team roster details could not be loaded.</p>}
    {!summary.initialized ? <Card title="Team roster not initialized">
      <p>The fixed 20-team roster is not available yet. It will appear after the separately approved roster migration is applied.</p>
    </Card> : <>
      <Card title="Team availability">
        <p className="text-ink">{summary.assigned} assigned · {summary.available} available · {summary.capacity} total places</p>
        {summary.overCapacity && <p role="alert" className="mt-2 text-red-300">An existing team exceeds its configured capacity. Review assignments before making changes.</p>}
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.teams.map((team) => {
          const members = memberships.filter((member) => member.team_id === team.id)
            .flatMap((member) => {
              const application = applicationById.get(member.application_id);
              if (!application) return [];
              const profile = profileById.get(application.profile_id);
              const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Selected applicant';
              return [{ application, profileId: application.profile_id, name }];
            });
          return <Card key={team.id} title={team.name}>
            <p className="mb-3 text-sm text-ink">{team.occupied}/{team.capacity} assigned · {team.available} available</p>
            <ul className="space-y-2">
              {members.map((member) => <li key={member.application.id} className="border-b border-line pb-2 text-sm">
                <Link href={'/aluna-admin/first-340/' + member.profileId} className="text-gold hover:underline">
                  {member.name} · application v{member.application.application_version}
                </Link>
              </li>)}
              {!members.length && <li className="text-sm text-muted">No selected applicants assigned.</li>}
            </ul>
          </Card>;
        })}
      </div>
    </>}
  </div>;
}
