# PR #45 / Issue #44 — Security-sensitive migration content audit (read-only)

Date: 2026-11-08. Source: branch `feature/impact-history-financial-contributions-20261108`. Target inspected: shared Supabase Demo `zujkasvuxrleisbsnrxv`.

**Scope:** Read-only verification of runtime artifacts named in 12 high-risk historical GitHub SQL migration files. This audit is **not** proof that every historical migration was executed identically, nor permission to repair ledger entries or apply SQL.

## Examined migration files

1. `202610180007_atomic_organization_access_audit.sql`
2. `202610180008_atomic_invitation_delivery_failure.sql`
3. `202610190001_onboarding_demographics_v4.sql`
4. `202610190002_require_onboarding_demographics.sql`
5. `20261021024500_restore_organization_security_parity.sql`
6. `20261021030000_restore_phase19_media_controls.sql`
7. `20261021053000_restrict_payment_webhook_rpc_execution.sql`
8. `20261022000200_pr33_security_definer_privacy_and_referrals.sql`
9. `202610160002_organization_claim_management.sql`
10. `202610180001_aluna_admin_role_management.sql`
11. `202610180004_aluna_data_api_suspension_guard.sql`
12. `20261015030000_campaign_archive_checkout_race_guard.sql`

## Evidence from current shared Demo catalog

- All **28** selected distinct function names extracted from these SQL files have at least one existing `public` PostgreSQL function. These function-name checks do not prove exact signatures, bodies or historical ordering; several functions were overwritten by later scripts.
- `anon` cannot execute `record_checkout_payment_event`, `record_confirmed_donation`, `record_donation_refund`, `record_subscription_event`, `aluna_admin_set_organization_role`, `approve_first_organization_claim`, `redeem_organization_invitation`, or the selected `aluna_audited_*` functions.
- Six `storage.objects` `phase19 * media upload/read` policies exist: profile, post and message media.
- `public.organization_admin_audit` has the expected Aluna Super Admin SELECT policy.
- `aluna_super_admins`, `organization_access_audit`, `organization_admin_audit`, `organization_claim_requests`, `organization_invitations`, `organization_verified_domains` have row-level security enabled, and `anon`/`authenticated` lack direct INSERT on those tables.
- Five selected functions checked for anonymous access: `aluna_admin_set_organization_role` = false; `aluna_require_active_data_api_session`, `create_profile`, `visit_campaign_referral`, `visit_fundraiser_referral` = true. The last four use SECURITY DEFINER. **Do not label them vulnerabilities solely because the grant exists**; inspect full function bodies, trigger context, intended public access and security preconditions before changing their grants. They remain explicit review items.
- Profile SELECT policy is currently called `Read member profiles`; a historical migration used `Read own profile`. This difference is evidence of later policy evolution, not proof of a missing migration.
- On inspection, the most recent Vercel preview associated with documentation commit `171efb5` was READY. This is a Vercel build, **not independent typecheck/lint/security release certification**.

## Interpretation for migration reconciliation

**Runtime artifacts confirmed:** selected functions, object security posture, current attachment policies, selected permission revocations.

**Not yet confirmed:** exact SQL equivalence for each migration; complete function-body signatures and all overloads; whether database objects were subsequently overwritten or dropped; one-to-many mapping from historical SQL files to remote recorded executions; migration ledger repair command list.

Retain the status **UNCONFIRMED** for each of the 12 local SQL files until full definition comparisons and chronology validation are complete. Avoid replaying these files into shared Demo.

## Next safe gates

1. Reconcile historical exact definitions and chronological supersession across GitHub files, remote catalog and migration ledger.
2. Review the four anonymously executable SECURITY DEFINER functions for intended access and resistance to privilege escalation.
3. Verify backup and restore via an isolated restore rehearsal before any shared Demo mutation.
4. Finish independent CI and mobile-specific QA.
5. Do not run `db push`, `db reset --linked`, manual ledger edits or migration repair without a separate reviewed change plan and authorization.

Related: [issue #44](https://github.com/Aluna2027/Aluna/issues/44), [PR #45](https://github.com/Aluna2027/Aluna/pull/45).
