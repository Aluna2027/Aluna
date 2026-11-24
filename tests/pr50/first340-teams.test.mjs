import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeFirst340Roster, sortFirst340Teams } from '../../lib/first340-teams.ts';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const rosterMigration = read('supabase/migrations/20261124130000_pr50_first340_fixed_team_roster.sql');
const lifecycleMigration = read('supabase/migrations/20261123090000_pr50_first340_application_lifecycle.sql');
const integration = read('tests/pr50/first340-migration.integration.sql');
const review = read('components/first340-review-decision.tsx');
const dossier = read('app/(app)/aluna-admin/first-340/[profileId]/page.tsx');
const teamPage = read('app/(app)/aluna-admin/first-340/teams/page.tsx');

test('roster summary requires the exact 20 canonical teams and sorts numerically', () => {
  const teams = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: 'Team ' + (index + 1), capacity: 17 }));
  assert.deepEqual(sortFirst340Teams([teams[9], teams[1], teams[0]]).map((team) => team.name), ['Team 1','Team 2','Team 10']);
  const summary = summarizeFirst340Roster(teams, ['0','0','1']);
  assert.equal(summary.initialized, true);
  assert.equal(summary.capacity, 340);
  assert.equal(summary.assigned, 3);
  assert.equal(summary.available, 337);
  assert.equal(summary.teams[0].available, 15);
  assert.equal(summarizeFirst340Roster(teams.slice(0, 19), []).initialized, false);
  assert.equal(summarizeFirst340Roster(teams.map((team) => ({ ...team, capacity: 20 })), []).initialized, false);
});

test('roster migration is transactional, guarded, fixed at 20 x 17 and does not rewrite assignments', () => {
  assert.match(rosterMigration, /^-- PR #50:[\s\S]*?begin;[\s\S]*?commit;\s*$/i);
  assert.match(rosterMigration, /lock table public\.first340_teams[\s\S]*lock table public\.first340_team_members/i);
  assert.match(rosterMigration, /capacity = 17/);
  assert.ok(rosterMigration.includes("check (name ~ '^Team ([1-9]|1[0-9]|20)$')"));
  assert.match(rosterMigration, /generate_series\(1, 20\)/);
  assert.match(rosterMigration, /on conflict \(name\) do nothing/i);
  assert.match(rosterMigration, /group by team_id having count\(\*\) > 17/i);
  assert.doesNotMatch(rosterMigration, /delete from public\.first340_(teams|team_members|applications)/i);
});

test('team assignment keeps the existing Super Admin RPC lock and enforces capacity atomically', () => {
  assert.match(lifecycleMigration, /not public\.is_aluna_super_admin\(\)/);
  assert.match(lifecycleMigration, /select capacity into v_capacity from public\.first340_teams where id=p_team for update/i);
  assert.match(lifecycleMigration, /select count\(\*\) into v_count from public\.first340_team_members where team_id=p_team/i);
  assert.match(integration, /first340_fixed_team_roster\.sql/);
  assert.match(integration, /Expected full-team assignment rejection/);
  assert.match(integration, /Expected unavailable team rejection/);
  assert.match(integration, /Release team place/);
});

test('review UI reveals team assignment only for Selected and gives contextual keep-current labels', () => {
  assert.match(review, /status === 'selected'/);
  assert.ok(review.includes("Keep current team (' + currentTeamName + ')'"));
  assert.match(review, /No team assigned — leave unchanged/);
  assert.match(review, /team\.full && team\.id !== currentTeamId/);
  assert.match(review, /approved database migration is applied/);
  assert.match(dossier, /requireAlunaSuperAdmin/);
  assert.match(dossier, /First340ReviewDecision/);
});

test('team overview is Super Admin guarded and links only selected applicants to their dossier', () => {
  assert.match(teamPage, /requireAlunaSuperAdmin/);
  assert.match(teamPage, /application\.status === 'selected'/);
  assert.match(teamPage, /\/aluna-admin\/first-340\//);
  assert.match(teamPage, /Team roster not initialized/);
});
