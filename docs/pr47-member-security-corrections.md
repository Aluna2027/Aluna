# PR47 member security corrections

Prepared only: 20261121033802_pr47_members_only_audience.sql. No migration execution.

Personal timelines use UserProfile → ActorSocial → ActorPosts → posts filtered by actor_id. OrganizationPosts also queries posts directly. RLS, rather than feed_page, controls both. Members-only authors receive no ownership exception after membership loss. Organization administrators can act through current organization actors; ordinary organization members cannot.

Repost reads no longer recurse, preserving historical public/follower visibility. New reposts reject self references and cyclic target chains using a visited UUID array; member reposts inherit the exact immutable audience/context. Original content remains separately RLS protected. Existing published rows are not rewritten.

The notification BEFORE INSERT gate covers all existing post/comment/reaction/mention generators. Member recipients must pass the all-administrator recipient helper; self notifications are suppressed. Existing public/follower generation is unchanged. Notification SELECT policy and badge count queries enforce current post access. Membership changes are reflected on the next counter refresh; already displayed content cannot be recalled.

Scheduled member media now requires owner control AND current context membership. A stale schedule cannot provide an owner exception to an already published post. Publisher already verifies membership before publication. Historical public/follower scheduled media retains ownership access.

## Signed URL limitation — unresolved release gate

Application member media paths do not generate signed URLs; the authenticated proxy rechecks posts RLS and Storage RLS for each request and streams with private/no-store. Direct Storage signing is still available to an authorized member under Storage SELECT. A revoked nonmember cannot obtain a new URL, but any bearer URL issued while authorized remains usable until its chosen expiry. RLS does not revoke previously signed URLs. Already downloaded files also cannot be recalled.

Strict immediate revocation requires a separate private media boundary that denies client Storage SELECT/signing, with trusted server delivery after membership authorization. This requires a reviewed server-only credential path or equivalent Storage signing restriction and migration/upload compatibility work. It is not solved merely by the proxy. No bucket, key, authentication setting, or infrastructure change has been made. Consequently strict signed-URL revocation remains BLOCKED and recommendation for applying this migration is NO-GO pending that mitigation or explicit owner acceptance of bounded URL validity.

## Migration alignment

Demo identity previously confirmed ACTIVE_HEALTHY: zujkasvuxrleisbsnrxv, Aluna Global Network Demo. Applied PR47 versions: 20261117024100, 20261117085129, 20261121004222, 20261121013125. Pending version 20261121033802 absent. Only this pending file changes. Reuse the completed Issue #44 baseline and accepted historical exceptions; exclude every historical replay candidate. No db push, repair, reset, direct ledger edits or historical replay.

## Acceptance limits

Contract regression tests do not prove live RLS. After separate migration approval, authorized live acceptance must check member/nonmember/revoked author, organization admin versus member, direct tables/RPCs, timelines, hashtags, notifications/counters, comments/reactions, repost cycles/inheritance, schedules and media/signing. Previously denied SQL tests have not been rerun. No media downloads were needed for this review.

Migration SHA-256 (exact UTF-8 file): 7199800209990DE304B7AA7BD5350E21FD21A515042533407D2E51CCDC31D776. Local PR47 suite: 38 PASS; typecheck PASS; lint 0 errors/25 warnings. These include static SQL contracts, not executed RLS tests.
