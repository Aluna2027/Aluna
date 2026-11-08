# PR45 / issue #44: full migration ledger name inventory

> Read-only inventory as of 2026-11-08. **Do not use this inventory as a migration repair command list.** Matching names are not proof of byte-for-byte equivalence, and candidate matches are hypotheses only.

- GitHub SQL files: **64**. Remote ledger rows: **52**. Exact version matches: **0**. Exact name matches: **26**.
- Historical migration files can map one-to-many to remote migrations, and some changes were applied through the SQL Editor. Do not infer that unmatched files need executing.

## Verified SQL-content equivalence — 2026-11-08

**Read-only migration ledger comparison completed for every one of the 26 exact-name matched local/remote pairs.** Compared GitHub file text with SQL stored in remote `supabase_migrations.schema_migrations.statements`, not merely object presence or version suffix.

- **20/26 byte-for-byte identical**: all 16 original 20260924 migrations; `pr40_fundraising_participation_enum`; and the three registered PR43 migration files.
- **4/26 differ only in leading/trailing whitespace**: `creator_remove_archive_controls`, `profile_birthdate_organization_country`, `organization_mesh_remove_controls`, `restrict_anonymous_membership_rpc_execution`. Their trimmed source equals recorded SQL.
- **2/26 have equivalent statements but differ in comments/spacing**: `post_upvote_downvote` (indentation and comma spacing); `allow_accepted_connection_removal` (extra source comment and line layout). Statement-by-statement visual comparison confirmed and normalized text matched.
- **No material SQL discrepancy found in these 26 matched migrations**. Their recorded **version numbers still differ from the local filenames**, so automated `db push` remains unsafe.
- The other **38 local SQL files and 26 remote recorded migrations** remain unresolved for exact SQL matching and chronology. No repairs or migrations were executed.
- Note: the 26 comparisons establish *stored SQL script equivalence*; they do **not** prove that later migrations did not alter these database objects.

A conservative path for long-term migration management is a separate, reviewed **current-schema baseline** (as Supabase's official deployment guidance permits for severe drift), rather than renumbering or marking dozens of entries applied without verified schema equivalence. Prototype a baseline in an isolated clone first, and obtain explicit release approval before any shared Demo ledger edits. This is an option, not authorization for a new migration.

## Additional renamed-migration SQL matches — 2026-11-08

This section checks **15 further local/remote pairs** whose names differ. For each pair the tracked GitHub SQL file was compared against `array_to_string(statements, E'\\n')` in the corresponding recorded remote migration.

**Ten exact text matches:**
- `20261015030000_campaign_archive_checkout_race_guard.sql` ↔ `campaign_archive_checkout_race_guard_20261015`
- `20261015040000_scheduled_posts.sql` ↔ `scheduled_posts_20261016`
- `20261016070000_media_only_posts.sql` ↔ `media_only_posts_20261016`
- `202610160002_organization_claim_management.sql` ↔ `organization_claim_management_pr25c1`
- `202610170001_organization_members_relationships.sql` ↔ `organization_members_relationships_pr32`
- `202610180001_aluna_admin_role_management.sql` ↔ `aluna_admin_role_management_pr33`
- `202610180002_aluna_profile_moderation_audit.sql` ↔ `aluna_profile_moderation_audit_pr33`
- `202610180003_organization_domain_challenges.sql` ↔ `organization_domain_challenges_pr33`
- `20261021053000_restrict_payment_webhook_rpc_execution.sql` ↔ `pr33_demo_restrict_payment_webhook_rpc_execution`
- `202610280002_pr40_campaign_participation_and_totals.sql` ↔ `pr40_additive_campaign_participation_and_mission_totals`

**Four matches after removing line comments and whitespace:**
- `202610130002_document_attachments.sql` ↔ `document_attachments_for_posts_and_messages`
- `202610180004_aluna_data_api_suspension_guard.sql` ↔ `aluna_data_api_suspension_guard_pr33`
- `202610180005_activate_aluna_data_api_suspension_guard.sql` ↔ `activate_aluna_data_api_suspension_guard_demo`
- `202610180006_aluna_storage_suspension_guard.sql` ↔ `aluna_storage_suspension_guard_pr33`

**One material script difference, requiring policy review:**
- `202610130003_personal_timeline_visibility.sql` ↔ `personal_timeline_visibility_20261013`. GitHub adds `DROP FUNCTION IF EXISTS feed_page(...)`, an explanatory migration comment, `REVOKE ALL ... FROM public`, and explicit `GRANT EXECUTE ... TO authenticated`. The recorded remote migration includes the core `CREATE OR REPLACE FUNCTION` with the same feed-selection body, **but not** those extra statements. The current `feed_page` definition has the expected 12 returned columns; its `anon` and `authenticated` execution privileges are both currently **true**. As `feed_page` is a SECURITY INVOKER function and the global feed is intended to be public, this does **not** by itself establish a vulnerability. However its actual ACL is not equal to the apparent GitHub intention, and needs a separate authorization/compatibility decision. **Do not replay the whole migration or revoke anonymous access without testing.**

**Overall verified comparisons:** 41 distinct local-to-remote pairs (26 previously matched by name + 15 renamed). The renamed comparison found no other material SQL difference. No migration ledger or schema changes were made.

**Remaining coverage:** 23 local files and 11 remote registrations are still not one-to-one matched. Some of these are split migrations, additional Dashboard SQL, or files whose corresponding ledger entry is missing. Do not infer that all missing entries require SQL execution.

## GitHub migrations: exact and candidate mappings

| GitHub file | Recorded remote version/name, if exact name match | Candidate remote names (NOT verified) | Status |
|---|---|---|---|
| `202609240001_foundation.sql` | `20260925043602: foundation` | — | NAME EXACT (version mismatch) |
| `202609240002_cities.sql` | `20260925043609: cities` | — | NAME EXACT (version mismatch) |
| `202609240003_profiles_organizations.sql` | `20260925043617: profiles_organizations` | — | NAME EXACT (version mismatch) |
| `202609240004_social.sql` | `20260925043624: social` | — | NAME EXACT (version mismatch) |
| `202609240005_mesh_communities.sql` | `20260925043632: mesh_communities` | — | NAME EXACT (version mismatch) |
| `202609240006_missions.sql` | `20260925043639: missions` | — | NAME EXACT (version mismatch) |
| `202609240007_fundraising.sql` | `20260925043646: fundraising` | — | NAME EXACT (version mismatch) |
| `202609240008_referrals.sql` | `20260925043653: referrals` | — | NAME EXACT (version mismatch) |
| `202609240009_donations_payments.sql` | `20260925043702: donations_payments` | — | NAME EXACT (version mismatch) |
| `202609240010_contributions.sql` | `20260925043708: contributions` | — | NAME EXACT (version mismatch) |
| `202609240011_proofs_verification.sql` | `20260925043716: proofs_verification` | — | NAME EXACT (version mismatch) |
| `202609240012_impact.sql` | `20260925043722: impact` | — | NAME EXACT (version mismatch) |
| `202609240013_social_impact_graph.sql` | `20260925043803: social_impact_graph` | — | NAME EXACT (version mismatch) |
| `202609240014_first_340.sql` | `20260925043811: first_340` | — | NAME EXACT (version mismatch) |
| `202609240015_phase15_integration.sql` | `20260925043819: phase15_integration` | — | NAME EXACT (version mismatch) |
| `202609240016_auth_onboarding.sql` | `20260925043825: auth_onboarding` | — | NAME EXACT (version mismatch) |
| `202610040001_phase19_media_org_profiles.sql` | — | `20261004020205: phase19_media_org_fields` | UNCONFIRMED |
| `202610040002_aluna_member_role.sql` | — | `20261004040407: phase19_aluna_member_role` / `20261018015030: aluna_admin_role_management_pr33` | UNCONFIRMED |
| `202610040003_profile_names.sql` | — | `20261004052520: phase19_profile_names` / `20261004052554: phase19_profile_first_last_names` | UNCONFIRMED |
| `202610050001_mesh_communities_sdg9.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610050002_mission_manual_locations.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610050003_allow_fundraising_for_any_mission.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610050004_campaign_referral_performance.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610050005_referral_created_at_report.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610060001_sdg_missions.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610060002_atomic_sdg_mission_update.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610060003_creator_remove_archive_controls.sql` | `20261006005414: creator_remove_archive_controls` | — | NAME EXACT (version mismatch) |
| `202610070001_profile_birthdate_organization_country.sql` | `20261007035021: profile_birthdate_organization_country` | — | NAME EXACT (version mismatch) |
| `202610070002_organization_mesh_remove_controls.sql` | `20261007041700: organization_mesh_remove_controls` | — | NAME EXACT (version mismatch) |
| `202610070003_post_upvote_downvote.sql` | `20261007060657: post_upvote_downvote` | — | NAME EXACT (version mismatch) |
| `202610130001_allow_accepted_connection_removal.sql` | `20261013005036: allow_accepted_connection_removal` | — | NAME EXACT (version mismatch) |
| `202610130002_document_attachments.sql` | — | `20261013022335: document_attachments_for_posts_and_messages` | UNCONFIRMED |
| `202610130003_personal_timeline_visibility.sql` | — | `20261013033017: personal_timeline_visibility_20261013` | UNCONFIRMED |
| `20261015030000_campaign_archive_checkout_race_guard.sql` | — | `20261015114910: campaign_archive_checkout_race_guard_20261015` | UNCONFIRMED |
| `20261015040000_scheduled_posts.sql` | — | `20261016041354: scheduled_posts_20261016` | UNCONFIRMED |
| `202610160002_organization_claim_management.sql` | — | `20261016135539: organization_claim_management_pr25c1` | UNCONFIRMED |
| `20261016070000_media_only_posts.sql` | — | `20261016044126: media_only_posts_20261016` | UNCONFIRMED |
| `202610170001_organization_members_relationships.sql` | — | `20261016230513: organization_members_relationships_pr32` | UNCONFIRMED |
| `202610180001_aluna_admin_role_management.sql` | — | `20261018015030: aluna_admin_role_management_pr33` / `20261004040407: phase19_aluna_member_role` | UNCONFIRMED |
| `202610180002_aluna_profile_moderation_audit.sql` | — | `20261018020503: aluna_profile_moderation_audit_pr33` | UNCONFIRMED |
| `202610180003_organization_domain_challenges.sql` | — | `20261018020543: organization_domain_challenges_pr33` | UNCONFIRMED |
| `202610180004_aluna_data_api_suspension_guard.sql` | — | `20261018024555: aluna_data_api_suspension_guard_pr33` / `20261018024843: activate_aluna_data_api_suspension_guard_demo` | UNCONFIRMED |
| `202610180005_activate_aluna_data_api_suspension_guard.sql` | — | `20261018024843: activate_aluna_data_api_suspension_guard_demo` / `20261018024555: aluna_data_api_suspension_guard_pr33` | UNCONFIRMED |
| `202610180006_aluna_storage_suspension_guard.sql` | — | `20261018025443: aluna_storage_suspension_guard_pr33` / `20261018024555: aluna_data_api_suspension_guard_pr33` | UNCONFIRMED |
| `202610180007_atomic_organization_access_audit.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610180008_atomic_invitation_delivery_failure.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610190001_onboarding_demographics_v4.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610190002_require_onboarding_demographics.sql` | — | No strong name candidate | UNCONFIRMED |
| `20261021024500_restore_organization_security_parity.sql` | — | No strong name candidate | UNCONFIRMED |
| `20261021030000_restore_phase19_media_controls.sql` | — | No strong name candidate | UNCONFIRMED |
| `20261021053000_restrict_payment_webhook_rpc_execution.sql` | — | `20261021054252: pr33_demo_restrict_payment_webhook_rpc_execution` | UNCONFIRMED |
| `20261022000100_restrict_anonymous_membership_rpc_execution.sql` | `20261022034809: restrict_anonymous_membership_rpc_execution` | — | NAME EXACT (version mismatch) |
| `20261022000200_pr33_security_definer_privacy_and_referrals.sql` | — | No strong name candidate | UNCONFIRMED |
| `202610280001_pr40_fundraising_participation_enum.sql` | `20261028180647: pr40_fundraising_participation_enum` | — | NAME EXACT (version mismatch) |
| `202610280002_pr40_campaign_participation_and_totals.sql` | — | `20261028180712: pr40_additive_campaign_participation_and_mission_totals` | UNCONFIRMED |
| `202611010001_pr43_contributions_proofs_impact.sql` | `20261102055904: pr43_contributions_proofs_impact` | — | NAME EXACT (version mismatch) |
| `202611020001_pr43_l4_aluna_review.sql` | `20261102055907: pr43_l4_aluna_review` | — | NAME EXACT (version mismatch) |
| `202611020002_pr43_project_completion_impact.sql` | `20261102055910: pr43_project_completion_impact` | — | NAME EXACT (version mismatch) |
| `202611020003_pr43_canonical_network_snapshots.sql` | — | No strong name candidate | UNCONFIRMED |
| `202611020004_pr43_legacy_contribution_guard_compat.sql` | — | No strong name candidate | UNCONFIRMED |
| `202611020005_pr43_evidence_metadata_integrity.sql` | — | No strong name candidate | UNCONFIRMED |
| `202611020006_pr43_evidence_metadata_rls_recursion_fix.sql` | — | No strong name candidate | UNCONFIRMED |
| `202611020007_pr43_restrict_anonymous_rpc_execution.sql` | — | `20261021054252: pr33_demo_restrict_payment_webhook_rpc_execution` | UNCONFIRMED |
| `202611080001_pr45_super_admin_l4_override.sql` | — | No strong name candidate | UNCONFIRMED |

## Remote migrations without exact local-name pairing

| Remote version | Remote name | Status |
|---|---|---|
| `20261004020205` | `phase19_media_org_fields` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261004020345` | `phase19_media_storage` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261004020451` | `phase19_media_access_feed` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261004021113` | `phase19_media_permissions` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261004040407` | `phase19_aluna_member_role` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261004052520` | `phase19_profile_names` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261004052554` | `phase19_profile_first_last_names` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261010052924` | `restrict_organization_delete_and_wba_to_super_admin` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261010054431` | `organization_ownership_and_super_admin_wba_controls` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261010064641` | `allow_aluna_managed_company_x_name` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261013022335` | `document_attachments_for_posts_and_messages` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261013033017` | `personal_timeline_visibility_20261013` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261015114910` | `campaign_archive_checkout_race_guard_20261015` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261016041354` | `scheduled_posts_20261016` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261016041412` | `schedule_post_publication_every_minute_20261016` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261016044126` | `media_only_posts_20261016` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261016135539` | `organization_claim_management_pr25c1` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261016230513` | `organization_members_relationships_pr32` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261018015030` | `aluna_admin_role_management_pr33` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261018020503` | `aluna_profile_moderation_audit_pr33` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261018020543` | `organization_domain_challenges_pr33` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261018024555` | `aluna_data_api_suspension_guard_pr33` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261018024843` | `activate_aluna_data_api_suspension_guard_demo` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261018025443` | `aluna_storage_suspension_guard_pr33` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261021054252` | `pr33_demo_restrict_payment_webhook_rpc_execution` | Not exact-name mapped; may represent renamed/split migration or independently applied change |
| `20261028180712` | `pr40_additive_campaign_participation_and_mission_totals` | Not exact-name mapped; may represent renamed/split migration or independently applied change |

## Read-only conclusions

1. No source version equals its associated remote ledger version. This is broad pre-existing ledger drift, not just PR43.
2. The three PR43 migration names on remote match tracked SQL migration names but their versions differ. The five later PR43 migrations are absent from remote ledger, while specific runtime effects were verified separately.
3. PR45 migration `202611080001_pr45_super_admin_l4_override.sql` is absent from the shared Demo ledger and schema, as expected. It is present/tested in an isolated clone under a generated clone-only migration name.
4. Before any repair, compare actual stored function definitions, triggers, constraints, RLS and current data shape against each candidate file; inspect migrations applied via Dashboard; verify backup recovery; establish exact ledger transformation and dry-run with CLI against correct project.
5. No `supabase migration repair`, `db push`, `db reset`, or schema/data changes to shared Demo are authorized by this document.

## Related

- [Issue #44](https://github.com/Aluna2027/Aluna/issues/44)
- [PR #45](https://github.com/Aluna2027/Aluna/pull/45)
