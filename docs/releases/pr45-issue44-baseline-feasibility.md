# Issue #44 — Baseline feasibility decision (READ ONLY)

Date: 2026-11-08. PR #45 branch: `feature/impact-history-financial-contributions-20261108`.

## Decision

**Do not generate, apply, or mark a new baseline migration as applied yet.** The isolated PR45 QA clone is not a reliable restored copy of the shared Supabase Demo. Without a faithful, verified schema+data/Auth/Storage restore, producing a baseline from this clone would omit live objects and could corrupt future migrations.

A baseline is a **new versioned starting point for future schema management**, not a substitute for a backup and restore rehearsal or a command that should be applied to an existing database. It needs an explicit cutover policy and historical migration archival strategy. SQL migrations in GitHub must not be replayed on shared Demo.

## Read-only catalog comparison

| Metric | Shared Demo | Current PR45 QA clone |
| --- | ---: | ---: |
| Public ordinary tables | 58 | 47 |
| Public PostgreSQL functions | 133 | 96 |
| Public RLS-enabled tables | 58 | 47 |
| Public RLS policies | 91 | 79 |
| Storage RLS policies | 10 | 2 |
| Migration history records | 52 | 45 |
| Auth users | 27 | 9 |
| Storage objects | 25 | 3 |

Both projects were inspected with read-only system catalog COUNT queries. These metrics show the clone is unsuitable to serve as a canonical current-schema baseline. The clone includes PR45 changes that shared Demo does not yet have.

## Established issue #44 facts

- 64 tracked GitHub migration SQL files vs. 52 remote migration ledger entries; no matching version numbers.
- 42 tracked local scripts were positively linked to remote stored SQL by exact or normalized script comparison. The others have varying status; runtime objects alone do not prove identical application.
- Some GitHub changes were manually applied outside the migration ledger.
- The planned PR33 referral anti-abuse / hashed visitor dedup table and 3-argument RPC migration is absent from shared Demo, meaning not all drift is merely ledger metadata.
- PR45 isolated integration has been functionally accepted, but its new tables and RPCs are not installed in shared Demo.
- The Windows backup files are not available through this conversation; therefore an isolated full restore rehearsal is **not completed**.
- Authenticated mobile browser acceptance is still outstanding.

## Reproducible catalog parity test — 2026-11-08

A new **read-only** query is tracked at `scripts/pr45-restore-parity.sql`. Execute the identical SQL against shared Demo and a separately restored, faithful, isolated target. The output contains only category counts and deterministic catalog comparison digests, never raw users, passwords, or Storage bytes. Fingerprints are **diagnostic**, not backups or cryptographic proof of recovery.

Initial measurement (before any fresh restore):

| Category | Shared Demo | Existing PR45 QA clone | Match |
|---|---:|---:|---|
| Public columns | 482 | 375 | No |
| Public constraints | 369 | 287 | No |
| Public functions / function ACLs | 133 | 96 | No |
| Public RLS flags | 58 | 47 | No |
| Public and Storage policies | 101 | 81 | No |
| Public triggers | 24 | 17 | No |
| Extensions | 7 | 6 | No |
| Auth users | 27 | 9 | No |
| Storage objects | 25 | 3 | No |
| Migration ledger rows | 52 | 45 | No |

The computed catalog digests also differ in every inspected structural category. This is expected because the QA clone was built from a partial subset and additionally has PR45 schema changes, but proves that **the existing clone must not be labelled a completed disaster-recovery rehearsal**.

**Remaining verification requires the actual backup files and a new isolated restore target.** An identical catalog fingerprint still cannot establish row-data consistency, file-byte integrity, Auth session validity, external integration configuration or successful application smoke tests. Compare those independently.

## Safe staged baseline approach (proposed, not executed)

**Stage A — Freeze/backup:**
1. Record exact project refs, repo commit, schema fingerprint, data row counts, migration ledger, RLS and grants.
2. Obtain a fresh, verifiable export of shared Demo schema/data, Auth and Storage binaries/metadata, roles/config where applicable.
3. Validate backup checksum and rehearse a restore in a **new isolated target**, without production credentials in logs or committed artifacts.
4. Compare restored schema and row counts across tables, policies, functions, triggers, extensions, Auth and Storage. Resolve any mismatches before going on.

**Stage B — Baseline construction:**
1. Derive the future baseline from the **actual shared Demo schema snapshot**, not from the incomplete PR45 clone.
2. Review generated SQL for Supabase-managed schemas, ownership/grants, platform extensions, generated identities, policy ordering and secrets. Do not commit dumps with user data or credentials.
3. Decide how historical 64 files will be retained for audit while excluded from replay on new environments. Test a brand-new local database from the proposed baseline and compare catalogs to the faithful restored source.
4. Explicitly include or intentionally exclude pending PR45 L4 schema and separately tracked PR33 referral anti-abuse fix. Avoid silently combining unrelated security changes.

**Stage C — Controlled cutover:**
1. Obtain a separate human release approval for the exact baseline and remote ledger changes.
2. Perform a ledger-only reconciliation only after verifying no SQL is replayed by the planned CLI commands; keep an original ledger export and pre-approved recovery plan.
3. Verify a no-op migration check on the target, using a reviewed CLI version, before enabling ordinary future migration pipelines.
4. Only then plan PR45 migration → isolated smoke tests → shared Demo smoke tests → PR merge as separately authorized operations.

## Release gate

**BLOCKED**, not because L4 functionality failed, but because a trusted restore and baseline rehearsal are unavailable. The existing clone is appropriate for targeted PR45 functional testing but not for proving disaster recovery or cutover fidelity.

No SQL migration, ledger repair, Supabase project change, production deploy, or merge is authorized by this document.
