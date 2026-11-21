# PR47 release checklist

Status: Draft / NOT PRODUCTION READY. Final merge and production operations require separate approval.

## Release notes

Posts support selected user/organization mentions using stable Actor IDs and existing names, linked Unicode hashtags and indexed paginated hashtag filtering. Post editing and scheduled editing/publication carry annotations. Mention notifications use visibility checks and deduplication. Uploads are staged before publication.

## Verified evidence

- Implementation at `a4cebcca042ef0904241678d97f7f3bbcaf7bbb6`: typecheck and lint PASS; 18 parser/annotation/static security contract tests PASS. Static tests are not live authorization evidence.
- Supabase Demo `zujkasvuxrleisbsnrxv`: exact migration `20261117024100_pr47_post_annotations.sql` applied by CLI migration-up with exit 0. CLI migration-fetch first read the existing remote history into local execution files; list then showed no missing historical versions and only PR47 pending. No repair, historical replay, db push or manual ledger insertion.
- Actual postcheck: exact ledger name/version, JSONB columns, annotation tables, RLS policies, four triggers, three indexes, both edit RPC overloads and empty SECURITY DEFINER search paths.
- Live synthetic rollback assertions in `tests/pr47/demo-acceptance.sql`: person/organization references, three Unicode hashtag forms, edits/renames and shifted offsets, notification dedup, follower-only privacy, both scheduled-edit signatures, unauthorized updates/RPCs, annotation RLS, deletion cleanup.
- Existing cron published synthetic schedule `47a50000-5555-4555-8555-555555555555`: published status, zero retries, two mentions, hashtag and two notifications. Recipient rename between scheduling/publication retained the stored reference.
- Test-source commit `50a1aade621ed8af215b9777dc3adb93a26292ca`: Vercel check SUCCESS. No application changes from implementation commit.

## Outstanding acceptance

- Cleanup of committed scheduler test fixtures was SQL-tool declined, including after explicit owner permission. Do not infer successful deletion. Known IDs: post/schedule `47a50000-5555-4555-8555-555555555555`; organization `47a40000-4444-4444-8444-444444444444`; auth users `47a10000-1111-4111-8111-111111111111`, `47a20000-2222-4222-8222-222222222222`, `47a30000-3333-4333-8333-333333333333` with `@pr47.invalid` emails.
- Multi-admin notification read authorization, removed/archived target cases, self-notification negatives, scheduler retry/error cases and unauthorized direct annotation writes need remaining live assertions. Catalog grants alone are insufficient.
- Authenticated desktop/mobile keyboard/touch, autocomplete, links, media and repost acceptance across all five composer surfaces. Browser automation cannot initialize in current Codex session (kernel-assets path error).
- Final exact-HEAD CI/check evidence after any new changes.

## Merge/production gate

1. Finish the outstanding acceptance and confirm fixture cleanup.
2. Confirm Draft PR exact head, successful required checks and no unintended data changes.
3. Obtain explicit owner approval to merge. Do not merge or mark ready merely because Demo migration succeeded.
4. Production is NOT assumed migrated. Identify the production project separately, verify schema/history, select only the committed version using an approved supported CLI workflow, and obtain separate production migration/deployment approval. Stop on history mismatch; never repair or replay to force deployment.

Owner explicitly accepted proceeding on Demo without a verified current recovery point. No backup investigation is a remaining gate. Transactional application does not provide post-commit recovery.
