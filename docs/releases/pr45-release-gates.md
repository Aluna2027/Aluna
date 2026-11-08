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
- **Not validated:** mobile-specific browser acceptance, standalone repository typecheck/lint/test jobs independently of Vercel build, and a restore rehearsal. Treat those as release gates, not PASS.

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

## Outstanding release blockers

- Issue #44 ledger mapping/reconciliation or a separately approved and documented one-off migration strategy.
- Fresh backup and restore confidence.
- Standalone CI checks and mobile acceptance still not independently established.
- Explicit authorization for shared Demo migration and subsequent PR merge.

**This document does not authorize migration, merge or production changes.**
