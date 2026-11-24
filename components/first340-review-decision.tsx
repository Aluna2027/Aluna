'use client';

import { useState } from 'react';

type TeamOption = { id: string; name: string; capacity: number; occupied: number; available: number; full: boolean };
type ReviewAction = (formData: FormData) => Promise<void>;

export function First340ReviewDecision({
  action,
  applicationId,
  initialStatus,
  statusOptions,
  currentTeamId,
  currentTeamName,
  teams,
  rosterInitialized,
  assigned,
  totalCapacity,
  available,
}: {
  action: ReviewAction;
  applicationId: string;
  initialStatus: string;
  statusOptions: readonly (readonly [string, string])[];
  currentTeamId: string | null;
  currentTeamName: string | null;
  teams: readonly TeamOption[];
  rosterInitialized: boolean;
  assigned: number;
  totalCapacity: number | null;
  available: number | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const showTeamAssignment = status === 'selected';

  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="id" value={applicationId}/>
    <section aria-labelledby="first340-review-heading" className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)]">
      <h3 id="first340-review-heading" className="sr-only">Application Review</h3>
      <label className="text-sm">Review status
        <select aria-label="Application status" name="status" value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-panel-raised p-2">
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="text-sm">Review note
        <input name="note" maxLength={2000} placeholder="Optional review note" className="mt-2 w-full rounded-lg border border-line bg-panel-raised p-2"/>
      </label>
    </section>

    {showTeamAssignment && <section aria-labelledby="first340-team-heading" className="rounded-xl border border-line p-4">
      <h3 id="first340-team-heading" className="font-semibold text-ink">Team Assignment &amp; Availability</h3>
      {!rosterInitialized ? <p className="mt-2 text-sm text-muted">The fixed team roster is not initialized yet. Team assignment becomes available after its approved database migration is applied.</p> : <>
        <p className="mt-2 text-sm text-muted">{assigned} assigned of {totalCapacity} places · {available} places available across 20 teams.</p>
        <label className="mt-3 block text-sm">Team
          <select aria-label="Team assignment" name="team_id" defaultValue="" className="mt-2 w-full rounded-lg border border-line bg-panel-raised p-2">
            <option value="">{currentTeamName ? 'Keep current team (' + currentTeamName + ')' : 'No team assigned — leave unchanged'}</option>
            {teams.map((team) => <option key={team.id} value={team.id} disabled={team.full && team.id !== currentTeamId}>
              {team.name} — {team.occupied}/{team.capacity} assigned, {team.available} available{team.full ? ' · Full' : ''}
            </option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-muted">A full team cannot receive another assignment. Capacity is checked again atomically when this decision is saved.</p>
      </>}
    </section>}

    <button className="rounded-lg bg-gold px-4 py-2 font-semibold text-navy">Save decision</button>
  </form>;
}
