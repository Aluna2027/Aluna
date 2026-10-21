# PR #33 — Migration reconciliation and release readiness

## Critical migration-source gaps — 2026-10-21

**Release decision: BLOCKED. Do not merge or deploy PR #33 based on green CI alone.** A read-only comparison of the actual SQL in `supabase_migrations.schema_migrations.statements[1]` on Demo versus **all 48 committed migration SQL files** revealed material source-control omissions. Previous evidence that seven PR33 functions match Demo remains valid, but does **not** establish parity for the earlier migrations.

| Priority | Demo migration history | GitHub branch source | Gap / risk |
| --- | --- | --- | --- |
| **P0 — Organization security / Super Admin** | `20261010052924` `restrict_organization_delete_and_wba_to_super_admin`; `20261010054431` `organization_ownership_and_super_admin_wba_controls`; `20261010064641` `allow_aluna_managed_company_x_name` | None of the 48 SQL files creates `aluna_super_admins`, `organization_admin_audit`, `protect_organization_fields()`, `can_archive_organization(uuid)`, `update_organization_wba(...)` or the management/owner/WBA-year columns. The committed Phase 19 SQL **grants authenticated WBA UPDATE** without the later Demo-only revocation/protection. | A fresh schema produced solely from GitHub migrations may fail Super Admin queries and lacks Demo's protected-organization-field guard. A permitted organization admin may be able to edit WBA scores directly unless another independent guard prevents it; verify through negative-write tests in a disposable fresh environment. Protect retention, ownership, archiving, audits and field permissions before merge. |
| **P1 — Media permissions and functionality** | `20261004020205` through `20261004021113`: `phase19_media_org_fields`, `phase19_media_storage`, `phase19_media_access_feed`, `phase19_media_permissions` | `202610040001_phase19_media_org_profiles.sql` creates key columns and bucket records but explicitly **defers** the range constraints, media policies, nullable-body check and media-enabled `feed_page` definition to other live Supabase migrations not committed in the repo. | All three buckets and six Phase 19 Storage policies are present in Demo, including conversation and post-view permissions; a fresh GitHub-only database is not proven equivalent. Media access may fail or differ in authorization. Also reconcile later document MIME additions. |
| **P1 — Scheduled post publisher** | `20261016041412` `schedule_post_publication_every_minute_20261016` | `20261015040000_scheduled_posts.sql` defines publication functions but ends with an explicit note **not to enable pg_cron** yet. | Demo has an active `cron.job` named `aluna-publish-scheduled-posts`, schedule `* * * * *`, command `select public.publish_due_scheduled_posts(25);`. The fresh GitHub-migration path does not install that job. Scheduling activation must be an explicitly reviewed environment/deployment decision, not an automatic replay. |

**Observed Demo safety controls (read-only):** `protect_organization_fields` is an enabled BEFORE UPDATE trigger on `public.organizations` with a SECURITY DEFINER function that logs protected changes; browser `authenticated` currently has **no WBA score UPDATE privilege**; the organization audit table and management/ownership fields exist. Demo has the three media buckets, six Phase 19 Storage policies, and an active scheduled-post cron job. These checks establish *Demo's current objects*, not a production baseline.

**Why CI was green:** Existing fresh-migration CI checks whether SQL applies, not all final expected tables, grants, triggers, storage policies, cron activation or HTTP-level access. The isolated role test explicitly builds its own Super Admin fixture, so it cannot prove a completely migrated repository schema contains the original Super Admin table.

### Safest next correction (feature branch only; separate acceptance)

1. Recover **the final intended behavior**, not blindly replay the Demo's old migration IDs or SQL. Prepare small, ordered, idempotent **forward-only** GitHub migrations for the missing organization security/ownership and the missing Phase 19 media controls. Review existing object/constraint names, dependencies, auditing and grant changes first. Do not hard-code personal bootstrap/admin accounts or run destructive changes.
2. Extend the **fresh full-Supabase CI** (not just role-fixture tests) with explicit assertions that `aluna_super_admins`, protected-field trigger, safe WBA permissions, ownership/archiving guards, critical media buckets and Storage policies exist. Include negative permissions and preserved-financial/proof-history scenarios in isolated tests.
3. Keep activation of the minute-level publisher separately gated: a reviewed setup per target environment with rollback, no duplicate scheduler, and proof the hosted runtime supports it.
4. Run the staged PR32→PR33 synthetic data upgrade and the fresh full migration suite after the source backfills. Confirm preexisting Demo-only objects and data would not be overwritten, duplicated or invalidated. **Only** then reconcile the full historical version-to-effect inventory, obtain a target-specific forward-only promotion plan, and request separate merge/deployment authorization.

**Explicit exclusions:** No Demo/Production schema or migration-history repairs; no full-replay of the 48 historical files, no direct copy of SQL that seeds a named person as Super Admin, no cron activation, and no merge.

---

## Read-only functional migration-definition comparison — 2026-10-21

Using `pg_proc.prosrc` from Supabase Demo and the **final** definitions in committed GitHub SQL files, all **seven relevant function bodies matched exactly after whitespace/case normalization**. No database writes were performed:

- `202610180007`: `aluna_audited_reject_claim`, `aluna_audited_revoke_invitation`, `aluna_audited_create_domain_challenge`, `aluna_audited_verify_domain`, `aluna_audited_revoke_domain` — **5/5 function-body matches**
- `202610180008`: `aluna_audited_invitation_delivery_failure` — **1/1 function-body match**
- `202610190002` (the final definition replacing the one in `202610190001`): `complete_member_onboarding_v4` — **1/1 function-body match**
- Six audited organization-access RPCs are **SECURITY INVOKER**, with empty `search_path`, not executable by `anon` or `authenticated` and executable by `service_role`. Onboarding v4 is **SECURITY DEFINER**, with empty `search_path`, executable by `authenticated` but not `anon`.
- Additional Demo objects verified: global `organization_verified_domains_unique_domain` is a valid UNIQUE btree index on `domain`; `profiles.gender` is nullable text with no default and a validated `profiles_gender_allowed` constraint; `profiles.date_of_birth` is nullable date; the restrictive Storage policy uses `aluna_is_active_account()` for both `USING` and `WITH CHECK`.

**Interpretation:** The absence of separately named Demo migration-history entries for files 007, 008 and onboarding v4 does **not** indicate a missing final implementation for these inspected functions and objects. This proves current observed *definition/permission equivalence* for the tested scope, **not** the full historical execution sequence, all triggers/grants/policies or semantic equality of every GitHub migration. The 48 GitHub SQL files versus 45 Demo migration records remain historically unreconciled, and should **not** be resolved by blindly replaying migrations or modifying Demo's migration-history table.

---

## Current update — 2026-10-21 (after isolated security acceptance)

**Tested candidate:** \`9dd7cc4466242a3bb9b40c9430293f16ba0110f0\`  
**Status:** All four GitHub workflows **PASS** at this exact SHA. PR #33 is still **Draft, unmerged and NOT CLEARED for Production**. Only the PR feature branch and disposable local CI databases have changed; **no Demo or Production database writes, migrations or configuration changes** were made during these tests.

| Test on candidate \`9dd7cc4\` | Current evidence | Scope and limitation |
| --- | --- | --- |
| Next.js typecheck, lint, build; mocked account-moderation scenarios (6/6) | [Integration run 39533026974](https://github.com/Aluna2027/Aluna/actions/runs/39533026974) — **PASS** | Mocked Auth and database client verify successful suspension, successful/reactivated state compensation after failed audit, explicit error on failed restore, Super Admin/self protection and unauthorized caller; *not* real Auth HTTP E2E |
| Isolated SQL role authorization / RLS | [Role run 39533026926](https://github.com/Aluna2027/Aluna/actions/runs/39533026926) — **PASS** | Permission denials, final-admin protection and audited authorized role updates, against synthetic fixtures |
| Complete 48-file local fresh migrations | [Fresh DB run 39533026969](https://github.com/Aluna2027/Aluna/actions/runs/39533026969) — **PASS** | Fresh disposable database only |
| Staged PR32→PR33 upgrade with persistent synthetic records | [Staged run 39533026909](https://github.com/Aluna2027/Aluna/actions/runs/39533026909) — **PASS** | Data preservation, grants, RLS, role audit rollback, invitation challenge/revocation/failure/one-use/email-bound/expiration, duplicate/expired domain challenge behavior and domain audit, all transaction-rolled-back |
| Same-subject suspension database guards | [Staged run 39533026909](https://github.com/Aluna2027/Aluna/actions/runs/39533026909), step "Verify Data API and Storage suspension guards" — **PASS** | Tests the **actual database-side hook function and Storage policy** for active, banned and nonexistent synthetic subjects; does **not** make PostgREST HTTP requests, test Storage API HTTP behavior or prove Realtime denial |

The previously accepted A, B, C1–C6 and D1–D6 UI checks are **not restarted**. The five SDG Mission tabs were visually accepted; donation, posting and proof-processing regressions have **not** been re-certified by this security test sequence.

### Current Demo vs GitHub migration reconciliation (read-only, 2026-10-21)

- GitHub: **48 migration SQL files**. Supabase Demo \`zujkasvuxrleisbsnrxv\`: **45 recorded versions**, latest \`20261018025443\`. These counts **must not be subtracted** to infer an exact number of unapplied changes. Version IDs and historical naming already diverge before PR #33.
- Demo records the equivalent **purpose/name**, but not the same version identifier, of PR33 files 001–006:

| PR33 GitHub migration | Demo recorded version/name | Status of evidence |
| --- | --- | --- |
| \`202610180001_aluna_admin_role_management.sql\` | \`20261018015030\` \`aluna_admin_role_management_pr33\` | Purpose/name correspondence, not full SQL equivalence |
| \`202610180002_aluna_profile_moderation_audit.sql\` | \`20261018020503\` \`aluna_profile_moderation_audit_pr33\` | Purpose/name correspondence |
| \`202610180003_organization_domain_challenges.sql\` | \`20261018020543\` \`organization_domain_challenges_pr33\` | Purpose/name correspondence |
| \`202610180004_aluna_data_api_suspension_guard.sql\` | \`20261018024555\` \`aluna_data_api_suspension_guard_pr33\` | Hook function exists; purpose/name correspondence |
| \`202610180005_activate_aluna_data_api_suspension_guard.sql\` | \`20261018024843\` \`activate_aluna_data_api_suspension_guard_demo\` | Live read-only inspection confirms \`authenticator\` has \`pgrst.db_pre_request=public.aluna_require_active_data_api_session\` |
| \`202610180006_aluna_storage_suspension_guard.sql\` | \`20261018025443\` \`aluna_storage_suspension_guard_pr33\` | A restrictive Storage policy named \`Aluna active account required for storage\` is present |

- Files \`202610180007\`, \`202610180008\`, \`202610190001\` and \`202610190002\` have **no separately recorded matching Demo migration versions**. Their principal RPC/schema effects are present as noted in the historical checkpoint below, but provenance, content equality and safely repeatable upgrade behavior **are not proven by their presence**. The current Demo contains the expected audited access functions; a read-only definition-hash inventory was obtained, but a complete reviewed canonical function-definition diff is outstanding.
- The read-only check found **zero public tables in Demo's \`supabase_realtime\` publication**. This is not a comprehensive review of Realtime channels, private broadcasts or authorization paths.
- Preserve all existing data; **do not repair migration history or reapply 48 scripts blindly**. Before an approved merge/deploy, produce a reviewed **forward-only, non-destructive** plan reconciled to each target environment and check that all critical functions, constraints, RLS, roles, and migration identities match expectations.

### Stacked PR integration and remaining release gates

- The open PRs #25–#33 are **Draft**. PR #33 targets **PR #32's branch**, not \`main\`; its current head is **208 commits ahead of main** with **95 files changed** in the GitHub comparison. This comparison does **not** authorize direct merge to \`main\`.
- PR #25 and #30 independently target \`main\`; PR #26→#27→#31→#32→#33 form a stacked ancestry path; PR #28→#29 diverge from PR #27. Code carried into PR #33 must be compared semantically for functionality and intended visual differences. The community Missions contextual "Create a mission" link from PR #28 was restored and passed Typecheck/Lint/Build.
- Outstanding: (1) verified authenticated HTTP requests by a banned account through Data API and Storage plus existing session behavior; (2) audit/role negative tests on a disposable actual Auth/API environment; (3) Realtime and issued-session authorization review; (4) controlled QA-owned DNS TXT validation, including expiry/replay and revocation, not \`example.org\`; (5) protected financial/proof data retention and regression testing of posting, donations, verification and mobile interaction; (6) forward-only Demo/Production migration reconciliation and final stacked merge order/review.
- Before any merge or Production deployment, require all applicable tests **PASS at the final candidate SHA**, reviewed migration plan and **separate explicit user release authorization**.

---

**Checkpoint:** 2026-10-19  
**Repository:** `Aluna2027/Aluna`  
**PR:** https://github.com/Aluna2027/Aluna/pull/33  
**Branch:** `feature/pr33-integration-admin-control-center-20261018`  
**Review basis:** `65f80bcde2d2b0028454275c5f9568a12dc4d44b`  
**Environment inspected:** Supabase **Demo only** (`zujkasvuxrleisbsnrxv`), read-only queries.  
**Decision:** **NOT CLEARED for merge or Production deployment.** Keep the PR Draft.

## 1. Evidence obtained

| Check | Evidence | Assessment |
| --- | --- | --- |
| Full fresh-database migration application | [GitHub Actions run 39246916593](https://github.com/Aluna2027/Aluna/actions/runs/39246916593); 48 ordered `.sql` files applied by `supabase start`, then reapplied successfully by `supabase db reset --local --no-seed`; local migration list succeeds | **PASS, clean local Supabase only** |
| Typecheck, lint, Next.js build | [Run 39246916466](https://github.com/Aluna2027/Aluna/actions/runs/39246916466) | **PASS** |
| Isolated role authorization / RLS / last-admin tests | [Run 39246916481](https://github.com/Aluna2027/Aluna/actions/runs/39246916481); PostgreSQL fixture executes actual PR33 role-management migration | **PASS in disposable fixture**, not a live Demo negative-write test |
| Invitation and Super Admin UI acceptance | Previous guided Demo acceptance of A; B security; C1–C6 functional checks | **Partly accepted**, see E2E exceptions below |
| Five SDG Mission tabs | Browser acceptance of Overview, Participate, Communication, Fundraising, Impact | **PASS for navigation and visible content**; not a retest of publishing, fundraising payments, or proof verification |
| Vercel preview | Build checks previously succeeded | **PASS for build**, not a comprehensive browser/security sign-off |

No actual Demo/Production migration was executed as part of this checkpoint.

## 2. GitHub vs Supabase Demo migration history

As observed 2026-10-19:

- GitHub PR branch: **48** `supabase/migrations/*.sql` files.
- Demo `supabase_migrations.schema_migrations`: **45** recorded migrations; latest recorded version `20261018025443` (`aluna_storage_suspension_guard_pr33`).
- **Do not subtract these counts to infer missing scripts.** Earlier GitHub and Demo migration identifiers/names also differ, and some changes were applied by other means. Version equivalence and semantic equivalence are **not established** by matching names or checking object existence.
- Demo includes six separately recorded PR33-era migrations corresponding by purpose to GitHub files `202610180001` through `202610180006`, but with different recorded timestamp/version IDs.
- Four later GitHub files have **no separate matching Demo migration-history entries**, despite their principal effects being observable:

| GitHub file | Observed in Demo (read-only) | What remains unproved |
| --- | --- | --- |
| `202610180007_atomic_organization_access_audit.sql` | Claim rejection, invitation revocation, challenge create/verify, domain revocation RPCs exist; domain uniqueness index exists | Full SQL/function-definition equivalence and applied provenance |
| `202610180008_atomic_invitation_delivery_failure.sql` | Delivery-failure RPC exists | Full SQL equivalence and applied provenance |
| `202610190001_onboarding_demographics_v4.sql` | `profiles.gender` and `profiles.date_of_birth` exist; `complete_member_onboarding_v4` exists; gender check constraint exists | Historical execution and exact intermediate state |
| `202610190002_require_onboarding_demographics.sql` | Current `complete_member_onboarding_v4` requires DOB and a valid gender choice | Historical execution and exact function definition equivalence |

For the audited organization-access and invitation RPCs, Demo privileges were inspected: `anon` and `authenticated` cannot execute the listed functions; `service_role` can. For `complete_member_onboarding_v4`, `authenticated` can execute the function and `anon` cannot. This privilege inspection is not a substitute for transaction-level E2E checks.

The Data API suspension pre-request hook was present on Demo's `authenticator` role, matching the intended configuration. This does not verify Storage, Realtime, or existing-session edge behavior.

**Interpretation:** Clean-install reproducibility is confirmed. Migration-history parity and **upgrade-in-place safety for an already populated environment are not confirmed**.

## 3. Release blockers / outstanding evidence

1. **Migrations & rollback:** Reconcile historical Demo migration entries against actual GitHub SQL/effects, including older renumbered or missing entries. Produce and test a **forward-only**, non-destructive upgrade path against an *isolated representative pre-upgrade schema with synthetic data*. Check existing data, RLS, grants, indexes, triggers, scheduling, role settings, and rollback procedures. Do not blindly rerun all 48 migrations or `supabase migration repair` against Demo/Production.
2. **Production scope:** PR #33 currently targets an unmerged feature base, **not `main`**. Review the entire stacked change/dependency chain and final production diff independently before any merge/promotion. The successful PR branch build does not certify a direct merge to `main`.
3. **Authorization and audit edge cases:** The isolated backend-role negative cases passed; a comprehensive **real authenticated negative-write E2E** across browser, RPC, and application routes has not been established. C4 audit-insert failure and moderation compensation need deterministic failure-injection or controlled isolated runtime testing.
4. **Domain control:** DNS TXT challenge verification, expiry/replay, domain uniqueness conflict handling, and revocation need an E2E test using a **domain explicitly controlled for QA**. The previously created `example.org` challenge does not establish DNS control.
5. **Invitations and membership exceptions:** Record end-to-end evidence for expiration, one-time/email-bound redemption, resend/revocation, permission boundaries and failure/no-partial-audit behavior. Avoid sending live invitations to unintended recipients.
6. **Suspended accounts / protected data:** Verify Data API and Storage denial, Realtime exposure review, sessions already issued, last-admin/Super Admin guardrails, and required retention of financial/proof/audit history. No real user deletion without a separately reviewed procedure.
7. **Scope/regression:** Confirm that the PR29 UI improvements intentionally superseded by PR33's shared card/icon styling remain acceptable, and that no posting/payment/verification flows regress. The five tabs' presence alone does not cover these behaviors.

## 4. Proposed next safe steps (no live writes)

1. Prepare a migration **version-to-effect mapping** from the 48 committed files and 45 Demo history records, inspecting statements rather than treating timestamps as identities. Confirm whether any current Demo object is semantically different from its desired definition.
2. Test upgrade-in-place on a separate temporary environment: start from a carefully reconstructed pre-upgrade state, synthetic organizations/users, then apply only the reviewed incremental SQL. Capture before/after schema and data invariants, grants and policy tests. Do not copy real personal/financial records.
3. Close outstanding E2E exception cases with disposable QA data and controlled authorization/DNS inputs, using test-only environments where failure injection is required.
4. Rerun required checks on the exact final candidate SHA and obtain **explicit release authorization** separately; only then plan a guarded deployment and rollback.

## 5. Hard safety boundary

- **No merges, production deployments, migration-history repairs, direct schema writes, or irreversible user/profile removals** authorized by this report.
- Keep the existing Demo and Production data untouched while investigating drift.
- This report intentionally does not mark the overall PR **PASS** or **release ready**.

### Primary artifacts

- [Full fresh Supabase migration test](https://github.com/Aluna2027/Aluna/actions/runs/39246916593)
- [Typecheck / lint / build](https://github.com/Aluna2027/Aluna/actions/runs/39246916466)
- [Isolated SQL authorization checks](https://github.com/Aluna2027/Aluna/actions/runs/39246916481)
- [PR #33](https://github.com/Aluna2027/Aluna/pull/33)
