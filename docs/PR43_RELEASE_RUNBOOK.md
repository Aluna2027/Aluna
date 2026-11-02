# PR #43 — Release runbook (Draft, 2 November 2026)

**DO NOT USE THIS DOCUMENT AS AUTHORIZATION TO MERGE OR MIGRATE THE SHARED ALUNA DEMO.**
This is a preparation and acceptance checklist, not an automated release. No change to `main` or shared Demo was made while writing it.

## Confirmed deployment targets

- Repository: `Aluna2027/Aluna`, PR #43, branch `feature/pr43-contributions-proofs-impact-20261101`
- Expected reviewed head before further change: `1ca7a8ff33593f7f9951f4ea4a1331b58823c6cd`
- Shared Demo Supabase project (DO NOT TEST-WRITE without specific authorization): `zujkasvuxrleisbsnrxv`
- Isolated QA clone (test writes allowed): `suedlkgemjsxttetgvkd`
- Vercel: `aluna-global-network-demo`, scope `frank-7164`
- User requirement: remain on Supabase free plan; no new paid branch or project.
- PR #43 remains Draft until all release gates are explicitly satisfied.

## Read-only shared Demo baseline (2026-11-02)

| Asset | Count |
| --- | ---: |
| `auth.users` | 27 |
| `profiles` | 27 |
| `organizations` | 3,253 |
| `missions` | 16 |
| `mesh_communities` | 7 |
| `fundraising_campaigns` | 15 |
| `contributions` | 0 |
| `proofs` | 0 |
| Applied migrations | 49; last version `20261028180712` |
| `post-media` objects | 20 (~79.3 MB) |
| `profile-media` objects | 5 (~0.5 MB) |
| `contribution-evidence` objects | 0 (bucket not created yet) |

These numbers are **changeable** and must be freshly checked immediately before any shared Demo migration.

## Gate A — independently restorable backup (BLOCKED: not yet created)

Supabase organization is confirmed **free**. Automatic daily database backups are only provided for paid plans. A logical database export is needed before shared Demo schema writes.

Official instructions:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/storage/management/download-objects

For a trusted machine with Supabase CLI and Docker, obtain the **session-pooler connection string** for the *shared Demo* from the Supabase Dashboard -> Connect. Keep the password and connection string out of chat, GitHub, issue comments, build logs, screenshots, and the repository.

Supabase documents these three CLI exports (replace the placeholder locally; never commit the resulting files):

```sh
supabase db dump --db-url "[DEMO_DATABASE_CONNECTION_STRING]" -f roles.sql --role-only
supabase db dump --db-url "[DEMO_DATABASE_CONNECTION_STRING]" -f schema.sql
supabase db dump --db-url "[DEMO_DATABASE_CONNECTION_STRING]" -f data.sql --use-copy --data-only
```

**Important coverage limitation:** Supabase CLI excludes managed `auth` and `storage` schemas by default. Even three successfully produced SQL files are **not a complete project backup**, especially for the 27 auth users; and SQL cannot contain the **actual** 25 Storage objects.

- Capture and verify a separately recoverable Auth-user strategy before calling the backup complete. Do not use a public `auth.users` export, expose password hashes, or assume the public `profiles` table is sufficient.
- Download and verify all 25 existing objects from `post-media` and `profile-media`. Use the Supabase Storage dashboard or a suitably authenticated Storage export method. Preserve bucket names and object paths. Media files are ~80 MB in total as of this baseline.
- Preserve bucket configuration, application environment configuration, and migration history information securely; secrets must remain in a secrets store.
- Verify every generated backup file is non-empty, record sizes and date, inventory included tables/rows/media and ensure the backup can be used in a documented recovery route. Validate on a safe environment if possible.
- Store backups **outside** the Git repository, in secure encrypted storage. Never paste private database connection strings here.
- **STOP** if an independent, complete, recoverable backup is unavailable. A Vercel rollback by itself does not undo a schema change.

## Gate B — PR #43 schema rehearsal (PASS, with limitation)

- All seven migration SQL files were executed **in order**, inside a `BEGIN` / `ROLLBACK` transaction on the isolated QA clone.
- Rehearsal temporarily incorporated the shared Demo's additional eight constraints, nullable manual-location mission schema, and PR #40 finance-sync trigger.
- New PR #43 Contribution creation succeeded in that combined environment.
- Post-rollback confirmed no leftover objects, triggers, dummy contributions, or lost original L4 verification/evidence.
- This was a **schema-parity simulation**, **not** an exact full-data clone or a completed disaster-recovery test.

## Gate C — shared Demo migration (NOT AUTHORIZED)

After explicit approval **and verified Gate A**:

1. Freeze changes and recapture counts, exact PR head, last Demo migration, Vercel target, and baseline of existing funding/payment flows.
2. Review all SQL again. Apply only to the named shared Demo, in numeric filename order:
   - `202611010001_pr43_contributions_proofs_impact.sql`
   - `202611020001_pr43_l4_aluna_review.sql`
   - `202611020002_pr43_project_completion_impact.sql`
   - `202611020003_pr43_canonical_network_snapshots.sql`
   - `202611020004_pr43_legacy_contribution_guard_compat.sql`
   - `202611020005_pr43_evidence_metadata_integrity.sql`
   - `202611020006_pr43_evidence_metadata_rls_recursion_fix.sql`
3. Critical: migration 005's restrictive RLS policy is fixed by 006. Do not enable the PR #43 evidence workflow between these migrations; finish the whole sequence, then verify final policies.
4. Verify seven recorded migration versions, private `contribution-evidence` bucket, RLS/grants, positive/negative authorized access, legacy Contributions guard, canonical network counts and project completion aggregation.
5. Check existing account login, organization administration, SDG Missions and fundraising (including Stripe test mode only). Stop on unexpected differences; keep `main` on previous application until database acceptance passes.

## Gate D — GitHub normal merge and Vercel smoke test (NOT AUTHORIZED)

- Only after explicit user approval following Gate C: **normal merge only; no squash**.
- Verify newly deployed Production SHA and READY status.
- Smoke test Global Feed, organization profile/claims, Missions, Fundraising, Contributions, Proofs, Impact and mobile.
- Restrict live payment tests to appropriate safe modes; never make destructive edits to real records.
- Monitor logs for newly occurring exceptions.

## Recovery rule

- Application code rollback: revert merge or redeploy known-good Vercel deployment.
- Database rollback: do not blindly drop PR #43 tables or restore an old schema after new uploads/verifications; this can delete audit evidence. Plan a data-preserving corrective migration or controlled restore after impact assessment.
- Storage objects need their **own** backup/recovery path; a database-only restore will not recover deleted media.
- If any release gate fails, **STOP, leave `main` untouched and report the exact failure**.

## Current decision

As of 2026-11-02, **Gate A is OPEN**, **Gate B is PASS**, **Gate C is not authorized**, and **Gate D is not authorized**. Do not merge PR #43.
