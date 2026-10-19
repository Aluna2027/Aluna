# PR #33 — Migration reconciliation and release readiness

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
