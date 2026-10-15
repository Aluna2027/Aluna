# Stripe Checkout / campaign archive — isolated acceptance matrix

**Status:** test plan only; NOT executed against Production. Run against a disposable PostgreSQL database with the pending migration applied. Use Stripe TEST mode for integration runs.

## Required checks

1. **New checkout vs archive:** two independent DB sessions; hold a row lock on fundraising_campaigns for campaign A. Concurrent INSERT into donation_checkouts and remove_or_archive_campaign(A) must serialize. If INSERT commits first, archive must reject pending checkout; if archive commits first, INSERT must reject archived campaign.
2. **Pending before Stripe session:** register a pending checkout with stripe_session_id NULL. Archive must reject it until payment reconciliation resolves it. Do not mark as resolved merely because Stripe session ID is missing.
3. **Open Stripe session:** register status='checkout' with stripe_session_id populated. Archive must reject; do not assume database archive expires the Stripe session.
4. **Settled one-time payment:** donation checkout paid and fundraiser_donations row present. Archive must return 'archived', preserve both records, and turn off campaign referral links.
5. **Active subscription:** monthly checkout with stripe_subscription_id and nonterminal subscription_status. Archive must reject. With confirmed canceled/expired status, archive may proceed while preserving records.
6. **Unauthorized owner:** unrelated authenticated actor cannot call remove_or_archive_campaign; the RPC must reject regardless of UI visibility.
7. **Late webhook:** if Stripe reports a successful payment after a prior state change, the verified payment must still be recorded idempotently; never discard a charge.
8. **Application validation:** block new donation request for archived or removed campaign; validate RLS/service-role access and existing request-key retry behavior.
9. **Regression:** profile, mission menu, fundraising menu and mobile breakpoints; typecheck, lint, build.

## Release gates

- Confirm tests 1–9 on an isolated database; attach outcomes and SQL transaction logs without secrets.
- Confirm migration does not break donation checkout creation.
- Verify Stripe TEST session creation, expiry and webhook delivery with disposable records.
- Do not merge PR #24 or apply the migration to the live demo until these tests pass.

## Known limits

A source-level inspection or Vercel build is NOT a concurrent PostgreSQL race test. This checklist does not prove runtime safety.
