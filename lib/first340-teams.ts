export const FIRST340_TEAM_COUNT = 20;
export const FIRST340_TEAM_CAPACITY = 17;
export const FIRST340_TOTAL_CAPACITY = FIRST340_TEAM_COUNT * FIRST340_TEAM_CAPACITY;

export type First340Team = { id: string; name: string; capacity: number };

export function formatFirst340TeamTransition(previousTeamId: string | null, nextTeamId: string | null, teamNames: ReadonlyMap<string, string>): string {
  const label = (teamId: string | null) => teamId === null ? 'No team' : teamNames.get(teamId) ?? 'Unavailable team';
  return `Team: ${label(previousTeamId)} → ${label(nextTeamId)}`;
}

export function sortFirst340Teams<T extends Pick<First340Team, 'name'>>(teams: readonly T[]): T[] {
  return [...teams].sort((a, b) => {
    const left = /^Team (\d+)$/.exec(a.name);
    const right = /^Team (\d+)$/.exec(b.name);
    if (left && right) return Number(left[1]) - Number(right[1]);
    return a.name.localeCompare(b.name);
  });
}

export function summarizeFirst340Roster(
  teams: readonly First340Team[],
  membershipTeamIds: readonly string[],
) {
  const sorted = sortFirst340Teams(teams);
  const expectedNames = Array.from({ length: FIRST340_TEAM_COUNT }, (_, index) => 'Team ' + (index + 1));
  const initialized = sorted.length === FIRST340_TEAM_COUNT
    && new Set(sorted.map((team) => team.name)).size === FIRST340_TEAM_COUNT
    && expectedNames.every((name, index) => sorted[index]?.name === name && sorted[index]?.capacity === FIRST340_TEAM_CAPACITY);
  const counts = new Map<string, number>();
  for (const teamId of membershipTeamIds) counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  const roster = sorted.map((team) => {
    const occupied = counts.get(team.id) ?? 0;
    return { ...team, occupied, available: Math.max(0, team.capacity - occupied), full: occupied >= team.capacity };
  });
  const assigned = roster.reduce((sum, team) => sum + team.occupied, 0);
  const overCapacity = roster.some((team) => team.occupied > team.capacity);
  return {
    initialized,
    teams: roster,
    assigned,
    capacity: initialized ? FIRST340_TOTAL_CAPACITY : null,
    available: initialized ? Math.max(0, FIRST340_TOTAL_CAPACITY - assigned) : null,
    overCapacity,
  };
}
