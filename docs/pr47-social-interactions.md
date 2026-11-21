# PR47 social interactions expansion — review evidence

Target: existing Draft PR47, branch feature/pr47-mentions-hashtags-20261117.

## Implemented
Shared notification badge context for desktop/mobile sidebar and header. Exact unread count is constrained by existing notification SELECT RLS, includes all kinds, hides zero and caps at 99+. Single coalesced count refresh per delivery; no polling. Route/focus/reconnection refreshes recover stale counts. Notifications page still clears only explicitly selected rows.

Reusable inline comments in FeedList (global, following, organizations, communities, missions and hashtag feed), profile posts, and detail page. Two initial comments per post via embedded PostgREST limit; batched actor lookup. Ascending created_at/id keyset pagination, 20 additional rows on demand. 350px scrolling region, keyboard focus, touch scrolling, expand/collapse, existing actor-based insert/delete permissions. Submission updates local state without feed reload. No replies/likes/edit controls existed on comments in this head; none removed.

Hashtags in comment text use the existing safe text renderer and link to existing post hashtag search; comment text is not added to that post-only search index. Existing post annotation code remains unchanged. Structured comment mentions are not implemented: the current validator includes scheduled-post identity and the sync function requires post visibility/ID fields. Reusing those triggers would be unsafe. A separate comment reference schema, validator and notification kind/target resolver with parent-post recipient visibility and deduplication is required before enabling comment mention selection. Plain @text sends no mention notification.

## Database safety
Read-only project lookup confirmed zujkasvuxrleisbsnrxv = Aluna Global Network Demo. Live comments SELECT uses can_view_post(post_id); INSERT requires can_act_as(actor_id) and can_view_post(post_id); DELETE requires can_act_as(actor_id). Notification SELECT/UPDATE uses can_act_as(recipient_actor_id). No elevated application database client introduced.

Live migration ledger includes PR47 20261117024100 and 20261117085129. Historical filename/ledger differences are already recorded in docs/releases/pr45-issue44-full-ledger-inventory.md; this change does not repair/replay historical versions. New CLI-generated 20261121004222 migration ONLY adds notifications to supabase_realtime if absent. Live publication check showed notifications absent. Migration NOT EXECUTED. Owner approval required for this single migration on Demo. No db push, repair, production changes, new accounts, password/session changes, or media requests.

## Checks
Existing 22 PR47 tests PASS. Three new pure logic tests PASS (badge boundary/transition formatting and comment pagination merge ordering/dedup); these do not constitute browser or delivery acceptance. Typecheck PASS before final review; lint zero errors, 27 existing warnings. Full production build PASS (57 pages generated). Local process isolation blocked Node test subprocesses; tests passed using --test-isolation=none. Dependency install: six moderate advisories.

## Open acceptance / NO-GO
Realtime arrival/read transition integration needs approved publication migration and authenticated acceptance. Desktop/mobile expansion, keyboard/touch scrolling, composer and deletion, authorization rejection, count synchronization, and bounded network volumes remain unverified in browser. Structured comment mentions remain outstanding. Keep Draft; do not merge.

