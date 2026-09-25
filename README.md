# Aluna Global Network — Phase 1

Next.js App Router, TypeScript, Tailwind CSS and Supabase Auth/PostgreSQL foundation.

## Setup

1. Run `npm install`.
2. Create a Supabase project and run `supabase/migrations/202609240001_foundation.sql` in its SQL editor (or use Supabase CLI migration workflow).
3. Copy `.env.example` to `.env.local` and supply the project URL and publishable/anon key. Keep service role and Stripe keys server-only; never prefix them with `NEXT_PUBLIC_` or expose them to browser code.
4. Configure the Supabase Auth site URL to your app origin and add `https://YOUR_ORIGIN/auth/callback` to redirect URLs. Enable email/password Auth. If email confirmation is enabled, new users must confirm before signing in.
5. Run `npm run dev`.

Account creation assigns `user`. University, NGO, and company account roles and organization memberships are database foundations only; do not let the client self-assign privileged roles. No public organization mutation policy exists yet.

## Checks

`npm run typecheck`, `npm run lint`, `npm run build`.

## Phase 2: World map & cities

Run `supabase/migrations/202609240002_cities.sql` after the foundation migration. The UI uses the checked `data/cities.json` snapshot so city exploration works without a live database query; the migration seeds the same records for later phases. The 162 supplied urban areas are derived from the uploaded workbook; coordinates come from a GeoNames gazetteer (with manual resolution of ambiguous urban-area names). `scripts/import-cities.py` records the import mapping and expects the supplied workbook and gazetteer during a future data refresh. The city figures are urban-area population estimates, not counts of slum residents or connected Aluna users. Region follows the country's geographic grouping. Tabs other than Overview intentionally contain placeholders.

Coordinate provenance: `cities.json` gazetteer (GeoNames, CC BY 4.0); a small set of ambiguous urban areas is resolved explicitly in the import script. To refresh, unpack the gazetteer at `/tmp/aluna-geodata/package/cities.json` and run `python3 scripts/import-cities.py`, then regenerate the SQL seed from the resulting JSON. Review every ambiguous or unmatched name before publishing an updated map.

## Visual identity

The color and typography tokens now follow the supplied September 2026 Aluna Global Network slide deck: near-black `#0A0C14`, dark panels `#11141D`, warm white `#ECE9E1`, muted gray `#A6AAB8`, and gold `#FFC53D`. The site bundles Archivo Variable for body and condensed headings, and Doto Black for small numeric accents. The five population colors remain distinguishable on the dark map while fitting this palette. These tokens live in `app/globals.css` and `lib/cities.ts` for later phases.

## Phase 3: Profiles and organizations

Apply `supabase/migrations/202609240003_profiles_organizations.sql` after Phase 2. This migration renames `organizations.kind` to `organization_type` and adds public profile fields, organization membership roles, and an atomic `create_organization` database function. An authenticated user can edit their own personal profile. A new University, NGO, or Company profile is created as unverified; its creator becomes an organization admin and can edit its details. Other members can view the profile and its People tab. Verification, invitations, posts, connections, funding and impact data are reserved for future phases. The legacy `profiles.role` column does not grant organization privileges.

For a new Supabase project, apply the migrations in filename order. If a deployment already has data, review the Phase 3 constraints on existing names before applying the migration. The app requires a configured Supabase instance for live profile persistence; a successful local build alone does not run migrations or authenticate users.

## Phase 4: Social network

Apply `supabase/migrations/202609240004_social.sql` after Phase 3. One actor represents each person or organization. A person controls their own actor; organization admins control their organization actor. The migration backfills existing profiles and creates actors for new profiles, adds feed posts, comments, reactions, follows, connections, notifications, and private conversations. Row-level policies protect follower-only posts, messages, author actions, and inboxes. Feed pages are limited to 20 items by default and use cursor pagination. Profile and organization pages expose Posts and Connections; individual profiles also expose Followers and Following. Other profile tabs still await their later phases.

The social flows require a real Supabase instance with all four migrations applied. The local TypeScript/lint/build checks do not verify PostgreSQL policies or message delivery against a live project.

## Phase 5: Physical Wi-Fi Mesh Communities

Apply `supabase/migrations/202609240005_mesh_communities.sql` after Phase 4. Each mesh community belongs to one seeded city (`places`), records its physical location, and can report population, connected people, node count, and local owners. Counts default to “Not reported” and newly created communities are marked unverified. A creating person or organization actor becomes the steward; controlled actors can join as members. Stewards can edit community details, while members can publish public posts to its feed. City Hubs and personal/organization profiles link to their communities. Missions, fundraising, contributions, proof and impact are placeholders.

A migration and app build are not a live data test. Configure Supabase and apply all five migrations to test authenticated creation, memberships, community posting and row-level permissions.

## Phase 6: Missions

Apply `supabase/migrations/202609240006_missions.sql` after Phase 5. Authenticated people and organization admins can create missions in a seeded city and optionally link a Wi-Fi Mesh Community in the same city. The creator can edit the mission. Controlled person or organization actors may join with one or more of the six participation options and post updates to its feed. Mission pages include location, goal, timeline, team, roles, budget, participants, comments, and links back to city, community, and profiles. Offers of help are expressions of interest, not verified completed contributions. Fundraising, donating, proofs, verification, and impact are placeholders; no money is collected.

Run `npm run typecheck`, `npm run lint`, and `npm run build` after applying changes. Live database behavior requires a configured Supabase project with migrations 1–6 applied.

## Phase 7: Fundraising

Apply `supabase/migrations/202609240007_fundraising.sql` after Phase 6. Mission creators can add campaigns; mission participants can create personal or team fundraiser pages under a campaign. Team members may join if they participate in the mission. Each fundraiser has a unique shareable URL, a story, updates, and comments. Its campaign and parent mission remain linked. Goals are editable; the displayed amount raised and donor count come exclusively from confirmed donation records.

Payments are not implemented. Ordinary application users cannot read or write donation records. A future trusted payment integration must verify provider events and write confirmed donations with stable provider references and donor references. Until then all progress starts at zero and the interface does not accept money. Live authorization and database behavior require a configured Supabase instance with migrations 1–7 applied.

## Phase 8: Sharing and referrals

Apply `supabase/migrations/202609240008_referrals.sql` after Phase 7. Existing and newly created fundraisers receive one unique token. The share menu uses ordinary platform share URLs for WhatsApp, Facebook, LinkedIn, X, Telegram and Email. Instagram and TikTok use the native share sheet when available, otherwise copy their channel-specific link for pasting; they have no general browser posting URL. QR codes are generated locally in the browser. `/r/<token>?source=<channel>` counts a referral visit and redirects to a public, read-only page at `/f/<slug>` so recipients can see a fundraiser before signing in. Campaigns have a public read-only page at `/c/<id>` with the same share options; campaign shares do not count toward an individual's fundraiser analytics.

Counts are aggregated per fundraiser and source without logging IP addresses, browser identifiers, or individual visitors. A seven-day first-party, HTTP-only cookie contains only the referral token and source, allowing a newly created fundraiser in the same campaign to be attributed. Clicks represent visits rather than unique people; bots and repeated visits can affect counts. Only the trusted Stripe webhook flow may set `referral_link_id` and `referral_source` on a verified donation. The database checks the referral and donation belong to the same campaign. The analytics dashboard is limited to the fundraiser owner and campaign owner.

## Phase 9: Donations and Stripe payments

Apply `supabase/migrations/202609240009_donations_payments.sql` after Phase 8. Configure `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `ALUNA_SITE_URL` as **server-only** environment variables. The site URL must use HTTPS outside local development. Set a Stripe webhook endpoint at `https://YOUR_ORIGIN/api/stripe/webhook` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `refund.created`, `refund.updated`, and `refund.failed`. Enable Stripe payment receipts and configure the Stripe Customer Portal to let signed-in monthly donors manage or cancel subscriptions. For local testing, use Stripe test keys and `stripe listen --forward-to localhost:3000/api/stripe/webhook`; use its local webhook signing secret.

Public campaign and fundraiser pages accept one-time card donations. Monthly recurring donations require an Aluna account so donors can manage them later. Checkout amounts and campaign currency are validated on the server; Stripe Checkout collects payment and receipt details. The secret service key is only used in server modules. Only verified Stripe webhook events write confirmed donation records. Event IDs, provider references, request keys and Checkout idempotency keys prevent double counting; full and partial refunds reduce campaign totals. Receipt URLs and customer information remain private and are shown to the donor on their account page. Anonymous means the donor's name is not displayed publicly, while Stripe still collects payment details. Company donations collect a business name and billing address. Mission sponsorship requires at least 100 units of the campaign currency. Presets are €10, €25, €50 and €100 for EUR campaigns; USD and GBP campaigns use the same numeric presets in their own currency.

Donations are not active until Stripe and Supabase are configured and migration 9 is applied. Verify the full Checkout, webhook replay, recurring renewal, failed payment, and refund paths with Stripe test mode before accepting live donations. A Stripe receipt is a payment confirmation; no tax-deductibility claim is made.

## Phase 10: Contributions

Apply `supabase/migrations/202609240010_contributions.sql` after Phase 9. Signed-in people and organization admins can record nine self-reported contribution types, link them to a mission, Wi-Fi Mesh Community and city, and browse their profile history and contribution detail. The database checks that linked places agree and limits creation to controlled actors. Money contributions are descriptions of self-reported activity; they do not create donations, affect campaign totals or serve as payment receipts. A live Supabase migration and authenticated browser session are needed to verify database behavior.

## Phase 11: Proof and verification

Apply `supabase/migrations/202609240011_proofs_verification.sql` after Phase 10. Proofs link to a public post or contribution; normal posts stay unchanged. Submissions start at L1. An independent actor can attest L2; advancing to L3 or L4 requires a trusted grant, an explanation, and an independently controlled actor. Changes are serialized and appended to the public, read-only audit history. An administrator must provision `proof_verifier_grants` through a trusted database/service-role process (never from a browser): grant only trained partner reviewers level 3 and trusted ground reviewers level 4. Record a meaningful rationale and revoke the grant when access ends. The schema reserves evidence origin and source identifiers for a future trusted mesh/sensor ingestion service; current reviews are manual only. Submitting sensor data or coordinates does not verify them. Source post deletion is intentionally restricted once a proof references it, preserving traceability. Verify migrations, RLS and reviewer grants against a live Supabase project before relying on published verification levels.

## Phase 12: Impact

Apply `supabase/migrations/202609240012_impact.sql` after Phase 11. Impact views aggregate existing community, mission, contribution, proof and confirmed-donation records; they do not seed demo values. Reported metrics remain distinct from verified results (Proof levels L3/L4). Contribution quantities are optional and only count as volunteer hours when explicitly recorded with the `hours` unit. `impact_graph_edges` is a read-only foundation for future aggregation jobs; no browser client can write graph edges.

## Phase 13: Social Graph and Impact Graph

Apply `supabase/migrations/202609240013_social_impact_graph.sql` after Phase 12. Follow, Connection and Member edges remain backed by their existing tables. Partner, Collaborator, Worked With, Funded and Supported use `actor_relationships`: the source actor requests, the target actor accepts or declines, and either controlled actor may remove the relationship. `social_graph_edges` returns a unified actor neighborhood without copying those records. `impact_graph_edges_for` traces actors through missions, communities, cities, contributions, proofs, verification events and impact results directly from the relational source of truth. The application intentionally does not require a graph database.

## Phase 14: The First 340

Apply `supabase/migrations/202609240014_first_340.sql` after Phase 13. This is an application attached to the existing personal account, never a new user type or platform cap. Provision administrators only through a trusted database/service-role process by inserting the intended existing `profile_id` into `aluna_admins`; there is no public admin-enrolment flow. A person may create and edit only their draft fields, submit via `submit_first340_application`, or withdraw a non-selected application via `withdraw_first340_application`. Official decisions and team assignments go through `admin_first340_decision` and append to `first340_audit`. Team rows are locked for capacity checks. Admin candidate activity RPCs use existing confirmed EUR payment, referral and contribution sources; amounts in other currencies are not converted or added to EUR. Reviews remain human decisions. Before production, validate the RLS scenarios and concurrent assignments against a real Supabase instance with separate applicant and administrator sessions; local typecheck/lint cannot prove database permissions.
