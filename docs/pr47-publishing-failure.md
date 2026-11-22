# Members-only publishing failure

Demo PostgreSQL logs at 2026-11-22 01:11:03.554 and 01:11:30.790 UTC show SQLSTATE 42501, `new row violates row-level security policy for table posts`. The PostgREST CTE inserts the text-only payload and RETURNING id, matching createPost's insert.select('id').single().

The applied SELECT policy calls STABLE can_view_post(id), which re-queries posts using the statement snapshot; it cannot see the new row during INSERT RETURNING. Before the member migration, the SELECT policy evaluated fields directly. The new migration restores row-field authorization via a shared SECURITY DEFINER predicate and delegates existing can_view_post callers to it. INSERT membership policies, triggers, constraints, restrictive active-account policies and Storage signing restrictions remain unchanged. No owner exception is added for Members-only reads.

The community is active. Read-only inspection confirms two individual and two organization actors are members. The failing request's bound actor/user values are not recorded in the logs, so the exact selected identity cannot be independently confirmed. Existing QA nonmember actor is not a member. No post insert or membership mutation was executed during diagnosis.

New migration 20261122011523_pr47_post_insert_returning_visibility.sql is PREPARED ONLY. Historical 20261121033802 is unchanged. Separate owner approval is required before applying the new migration. Static contracts do not prove successful live publishing. After approved application, repeat the original member text-only INSERT RETURNING case, verify nonmember INSERT denial and private read denial, and public/follower regressions. Until then the manual publishing test is expected to remain broken; do not ask the user to repeat it yet.
