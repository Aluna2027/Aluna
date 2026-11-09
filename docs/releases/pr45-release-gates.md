# PR #45 — Release gate and controlled migration plan

Status: **PREPARATION ONLY — DO NOT DEPLOY OR MERGE**  
Repository: `Aluna2027/Aluna` · PR: #45 · Branch: `feature/impact-history-financial-contributions-20261108`  
Reviewed preview commit: `36fdc1d0c1177641c0e150003a5941017f082108`

## Confirmed acceptance (2026-11-08)

- Standard PR43 L1 -> L2 -> L3 -> L4 database path passed on isolated clone, with four verification events.
- Super Admin direct internal L4 and trained L4 delegate authorization, revocation and negative permissions tested on clone.
- Browser acceptance: direct L4 approved PR43 QA Evidence Upload Test (0.25 verified volunteer hours); Impact displayed 1.25 Volunteer Hours and 2 Verified Results. Verified history and impact timeline distinguished internal approval (not independent).
- User confirmed the verified contributions are visible in Flying Innovators profile Impact.
- Vercel preview build/check on the reviewed commit is READY/success.
- **Validated on 2026-11-08:** PR45 independent GitHub Actions checks on commit `9639cc6132214588582ac68e2912accea1889f85`: existing isolated onboarding/security regression tests, `npm run typecheck`, `npm run lint` and `npm run build` all passed. Both [push run](https://github.com/Aluna2027/Aluna/actions/runs/42450038283) and [PR run](https://github.com/Aluna2027/Aluna/actions/runs/42450041704) concluded success. The associated Vercel preview is READY.
- **Not validated:** mobile-specific authenticated browser acceptance and a real restore rehearsal. The Windows backup SQL files remain local to the user's machine and were not available for an actual restore test.

## Shared Demo preflight (read-only inspection completed)

Project: `zujkasvuxrleisbsnrxv` (shared Demo; **do not run any change without explicit release authorization**).

- Existing objects: `aluna_super_admins`, `is_aluna_super_admin()`, `can_act_as(uuid)`, PR43 contributions/reviews and proof events.
- The PR45 RPC `pr45_super_admin_approve_result` and L4 grant table are **not yet installed**.
- Normal authenticated actors have no direct INSERT/UPDATE/DELETE rights on existing reviews, proof events or Super Admin membership.
- Existing proof-event method constraint does not contain internal L4 methods; the PR45 migration updates this constraint.
- Clone used to test PR45 contained a reconstructed Super Admin table because its baseline lacked this object. Shared Demo already has a matching two-column admin table. Never replay the clone-only baseline migration into shared Demo.

## Issue #44: migration ledger mismatch

See https://github.com/Aluna2027/Aluna/issues/44.

The shared Demo has historical migrations recorded under nonmatching version numbers, plus existing SQL applied via Dashboard and therefore absent from the migration ledger. **Do not run** `supabase db push`, `supabase db reset --linked`, or a batch replay of old GitHub migrations against shared Demo.

This drift specifically blocks automated remote migration pushes. It does not by itself show that PR45 SQL is incompatible with the current schema. However a release must explicitly account for how the new migration is executed and recorded.

## Release procedure — manual approval gate

1. Confirm the proposed exact PR45 commit, deployment, and migration checksum. Verify the repository migration file is identical to the one tested; if changed, retest on the clone.
2. Verify a fresh, recoverable database/auth/storage backup and a tested restore strategy. The previous 30-file backup is *not* evidence that restore has been rehearsed.
3. Re-check shared Demo schema dependencies, policies, constraints and active sessions; record row counts and current RPC/grant state as an immutable release baseline.
4. Choose **one** controlled migration strategy, explicitly document it, and obtain separate authorization before making changes to shared Demo:
   - First reconcile ledger **without replaying SQL**, using `supabase migration list`, inspection and documented `supabase migration repair` against a verified linked project; then run only the genuinely pending PR45 migration, **or**
   - Execute the single reviewed PR45 SQL migration through an approved controlled process, recording that the remote ledger is not automatically reconciled; do not subsequently allow automatic `db push` while issue #44 is open.
5. Apply the PR45 migration only once, using the chosen process, and verify: objects, constraints, `EXECUTE` grants, RLS, failed anonymous/ordinary-user writes, approved Super Admin/third-party actor cases, and audit traceability. Do not create extra real users or test records in shared Demo unnecessarily.
6. Verify Vercel environment scope and deploy order. **Never merge code depending on a missing PR45 RPC.** Complete the schema gate and smoke tests before approving the main merge.
7. Run security advisors and document disposition of new `SECURITY DEFINER` warnings: authenticated execution is intentional only with server-side `auth.uid()`, role and actor checks. Confirm direct client DML on verifier grants/audit tables remains forbidden.
8. Complete desktop/mobile smoke tests and independent CI/repository checks (typecheck/lint/test). If failures occur, halt, diagnose, and use a preapproved recovery plan (such as immediately disabling the new RPC's EXECUTE access); do not use an untested destructive rollback.
9. Obtain explicit approval before **any** merge, production deploy, or mutation to shared Demo.

## 2026-11-08 — Schema compatibility evidence (read only)

The shared Demo and the isolated PR45 clone were compared directly using PostgreSQL system catalogs.

- Across eight PR45-relevant existing tables (`aluna_super_admins`, `pr43_contribution_results`, `pr43_contribution_reviews`, `proof_verification_events`, `proofs`, `contributions`, `profiles`, `actors`), **87 of 87 column names and types match**.
- Existing constraints differ only in the comparison of examined objects as follows: `aluna_super_admins_profile_id_fkey` uses ON DELETE CASCADE in shared Demo and RESTRICT in QA clone; three profile length/gender constraints are present only in Demo; and QA clone's `proof_verification_events_method_check` already includes two PR45 L4 methods (as expected).
- Shared Demo has no PR45 grant tables or RPCs, so the planned `CREATE TABLE`/function declarations do not collide with those names. It does have `is_aluna_super_admin()` and `can_act_as(uuid)`, an existing proof-method constraint, and a review-role constraint that permits `aluna`.
- These checks show **no obvious prerequisite-schema blocker** for the singular PR45 migration. They are not a substitute for a transactional dry-run against a faithful restore and do not authorize a schema change.
- The clone does not faithfully match the Demo's other schema objects or all data, so isolated functional acceptance does not establish full database-restore integrity.

### Mobile release acceptance still required

Use the **isolated-preview deployment bound to QA Supabase**, not a freshly generated preview unless its environment is confirmed first. Under a narrow viewport (approximately 375 px) verify:
1. Contribution History categories expand/collapse and show both labelled internal L4 and ordinary verified records without horizontal page overflow.
2. Proof review form permits scrolling to all fields, viewing evidence and submitting an authorized internal L4 approval with readable feedback.
3. Global, Mission and Flying Innovators Profile Impact show correct QA totals and text describing internal/non-independent approval.
4. Super Admin L4 verifier grant and revoke forms fit on a mobile screen and do not expose actions to an ordinary account.
5. Verify links and the fixed Aluna mobile header do not cover input controls.

This is a manual/mobile browser acceptance list. Static source inspection does not mark any of these PASS.

## 2026-11-08 — QA clone security-advisor disposition (read only)

- The advisor reports `rls_enabled_no_policy` (INFO) for `pr45_l4_verifier_grants` and `pr45_l4_verifier_grant_events`. Both are explicitly protected by RLS, and system-catalog privilege inspection confirms **neither anon nor authenticated has direct SELECT or INSERT**. This is an intentional server-only / privileged-RPC access model, not by itself a database vulnerability.
- The advisor reports `authenticated_security_definer_function_executable` (WARN) for `pr45_can_approve_l4()`, `pr45_set_l4_verifier(...)` and `pr45_super_admin_approve_result(...)`. These are intentionally callable as authenticated RPCs; the two privileged mutations check `auth.uid()` and Super Admin/trained-verifier authorization inside the database, with actor authorization and reviewer-independence restrictions. `anon` EXECUTE is **false** on all three functions in the isolated clone.
- The Aluna L4 admin page uses `requireAlunaSuperAdmin()` before `adminDb()` on a **server-only** module. The service-role key is read from `SUPABASE_SERVICE_ROLE_KEY` and is not client-exposed by that module. Its server-action uses the authenticated RPC to perform grants/revocations, rather than direct browser table writes.
- These findings have been reviewed at the **code / database privilege** level; they are not a penetration test. Preserve the intended access checks on every future RPC edit. The remaining security advisor findings for older unrelated objects require their own separate security backlog evaluation.
- Shared Demo has **not** received the PR45 migration; this disposition is for the isolated QA clone only.

## 2026-11-08 — L4 role decision matrix (isolated QA, read-only)

Executed `pr45_can_approve_l4()` with three simulated JWT subject contexts, each inside a `BEGIN READ ONLY` transaction, followed by `ROLLBACK`. Results:

| Simulated database request identity | Expected | Actual |
|---|---|---|
| No authenticated identity | false | false |
| Existing ordinary non-granted profile | false | false |
| Existing Aluna Super Admin profile | true | true |

No grants, reviews, or contributions were created or modified. All three decision checks passed. These are **read-only simulated-identity SQL checks**, *not* proof of real browser sessions or a full adversarial RLS test. Prior isolated end-to-end L4 approval tests still stand separately.

The conversation attachments contain only screenshots, not the full Windows SQL/Auth/Storage backup files. Accordingly the full restoration rehearsal remains **OPEN** and must not be reported as PASS.

## Outstanding release blockers

- Issue #44 ledger mapping/reconciliation or a separately approved and documented one-off migration strategy.
- Fresh backup and restore confidence: actual backup SQL/Auth/Storage files have not been made available for a recovery rehearsal, and the PR45 QA clone is not a faithful/full restored copy of the shared Demo.
- CI checks PASS (as above), but authenticated mobile browser acceptance remains open; static inspection does not replace responsive browser QA.
- Explicit authorization for shared Demo migration and subsequent PR merge.

**This document does not authorize migration, merge or production changes.**
