'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sql = read('supabase/migrations/202611080001_pr45_super_admin_l4_override.sql');
const api = read('app/api/pr45/admin-approve/route.ts');
const grants = read('app/(app)/aluna-admin/l4-verifiers/actions.ts');
const impact = read('lib/impact.ts');
const history = read('components/contribution-history.tsx');

test('PR45 privileged RPCs require authenticated identity and authorization', () => {
  assert.match(sql, /create or replace function public\.pr45_can_approve_l4\(\)/i);
  assert.match(sql, /auth\.uid\(\) is not null[\s\S]*public\.is_aluna_super_admin\(\)/i);
  assert.match(sql, /create or replace function public\.pr45_super_admin_approve_result\(/i);
  assert.match(sql, /if auth\.uid\(\) is null or not public\.pr45_can_approve_l4\(\) then/i);
  assert.match(sql, /p_actor is null or not public\.can_act_as\(p_actor\)/i);
  assert.match(sql, /if not public\.is_aluna_super_admin\(\) and \([\s\S]*public\.can_act_as\(v_contribution\.actor_id\)[\s\S]*reviewer_profile_id=auth\.uid\(\)/i);
});

test('PR45 audit event identifies internal review and persists distinct confirmed amount', () => {
  assert.match(sql, /insert into public\.proof_verification_events[\s\S]*aluna_super_admin_override[\s\S]*aluna_accredited_l4_review/i);
  assert.match(sql, /NOT independent verification/i);
  assert.match(sql, /verified_quantity = p_value/i);
  assert.match(sql, /select \* into v_result[\s\S]*for update/i);
  assert.match(sql, /if v_result\.verification_level = 4 then/i);
  assert.match(sql, /length\(v_reason\) not between 20 and 1600/i);
});

test('PR45 grant management is protected and audited, with revocation', () => {
  assert.match(sql, /create table public\.pr45_l4_verifier_grants/i);
  assert.match(sql, /create table public\.pr45_l4_verifier_grant_events/i);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /revoke all on public\.pr45_l4_verifier_grants, public\.pr45_l4_verifier_grant_events/i);
  assert.match(sql, /if auth\.uid\(\) is null or not public\.is_aluna_super_admin\(\) then/i);
  assert.match(sql, /update public\.pr45_l4_verifier_grants set revoked_at=now\(\)/i);
  assert.match(sql, /insert into public\.pr45_l4_verifier_grant_events/i);
  assert.match(grants, /requireAlunaSuperAdmin/);
});

test('PR45 API validates quantity, actor, reason and does not claim independence', () => {
  assert.match(api, /client\.auth\.getUser\(\)/);
  assert.match(api, /client\.rpc\('pr45_can_approve_l4'\)/);
  assert.match(api, /Number\.isFinite\(quantity\)/);
  assert.match(api, /reason\.length<20\|\|reason\.length>1600/);
  assert.match(api, /independentlyVerified:false/);
});

test('PR45 Impact and Contribution History label internal approvals explicitly', () => {
  for (const value of ['aluna_super_admin_override', 'aluna_accredited_l4_review']) {
    assert.ok(impact.includes(value), 'Missing Impact label for ' + value);
    assert.ok(history.includes(value), 'Missing history classification for ' + value);
  }
  assert.match(impact, /not independent/i);
  assert.match(history, /not independent/i);
  assert.match(history, /verified_quantity/);
});
