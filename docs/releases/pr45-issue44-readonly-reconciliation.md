# Issue #44 — PR43 migration history reconciliation (READ-ONLY evidence)

**Inspection date:** 2026-11-08. **Target:** shared Supabase Demo `zujkasvuxrleisbsnrxv`.  
**Status:** inventory and functional evidence only; **NO ledger repair, migration, reset or schema mutation performed**.

## Tracked PR43 SQL vs currently recorded remote entries

| GitHub migration version | GitHub filename suffix | Remote migration record | Evidence / status |
| --- | --- | --- | --- |
| `202611010001` | `pr43_contributions_proofs_impact.sql` | `20261102055904` — `pr43_contributions_proofs_impact` | Name match only; existing PR43 tables present; **full migration content not byte-compared** |
| `202611020001` | `pr43_l4_aluna_review.sql` | `20261102055907` — `pr43_l4_aluna_review` | Name match; `pr43_review_result` exists and L1–L4 paths tested in clone, **not full Demo equivalence** |
| `202611020002` | `pr43_project_completion_impact.sql` | `20261102055910` — `pr43_project_completion_impact` | Name match; `pr43_impact_rollup` exists but was subsequently overwritten by canonical snapshots migration; do not replay |
| `202611020003` | `pr43_canonical_network_snapshots.sql` | **None found** | Current impact rollup exists; behavior has not been exhaustively compared to GitHub SQL |
| `202611020004` | `pr43_legacy_contribution_guard_compat.sql` | **None found** | `pr43_guard_contribution()` exists |
| `202611020005` | `pr43_evidence_metadata_integrity.sql` | **None found** | `PR43 evidence metadata integrity` policy exists, and was later replaced by recursion-fix SQL |
| `202611020006` | `pr43_evidence_metadata_rls_recursion_fix.sql` | **None found** | `pr43_own_evidence_object_exists(text,uuid)` function exists; evidence policy exists |
| `202611020007` | `pr43_restrict_anonymous_rpc_execution.sql` | **None found** | Anonymous `EXECUTE` privilege is **false** for all four targeted PR43 RPCs |

The last five changes were previously reported as executed through Supabase Dashboard, which did not write corresponding entries in `supabase_migrations.schema_migrations`. Names and database object existence are **insufficient** to prove the original SQL was applied verbatim. Confirm behavior, function definitions, policies and signatures before any ledger repair.

## Read-only shared Demo baseline

- Remote migration history: **52 records** (no PR45 remote migration).
- Existing `public` tables: **58**; `pr43_contribution_results` rows: **12**, `pr43_contribution_reviews` rows: **12**, `proof_verification_events` rows: **12**, `aluna_super_admins` rows: **1**.
- PR45's own `pr45_super_admin_approve_result` and trained-verifier grants are **absent** from shared Demo (expected before release).
- Existing `aluna_super_admins` is RLS-protected; `authenticated` has no direct INSERT, UPDATE or DELETE privileges on it, review records or proof verification events.
- Isolated QA clone includes and has exercised PR45 L4 flow; clone-only `pr45_clone_only_aluna_admin_dependency` **must never be applied to shared Demo**.

## Repair guardrails

1. Do **not** run `supabase db push` / `supabase db reset --linked` / any replay of old DDL on shared Demo.
2. Before ledger-only repair, inventory **all** local migration filenames, **all** remote versions and bodies/policy/function definitions (not only the eight PR43 files). Existing, older drift remains unclassified.
3. Identify mismatched versions explicitly; link CLI to the exact shared Demo project, run `supabase migration list`, and review `supabase migration repair --help` before any mutation.
4. Use `supabase migration repair --status applied|reverted` **only with separately approved, exact version-by-version plan**. Do not manually edit `supabase_migrations.schema_migrations` or delete data.
5. Validate historical object definitions and security grants after ledger reconciliation, then repeat a no-op dry-run. Maintain a copy of the original migration ledger as evidence and verify a restorable backup first.
6. PR45 rollout, merging to `main` and production deployment need their own explicit authorizations; this inventory grants none.

**Known limitation:** This inventory establishes the PR43-specific drift and verifies several database effects. It **does not fully reconcile** all 52 remote records with all historic tracked files. Treat issue #44 as open pending the exhaustive mapping and CLI diagnostic.
