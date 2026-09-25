# Aluna demo deployment

Deploy this Next.js project to Vercel with a separate Supabase **demo** project. Do not use the production database or payment account for sample activity.

1. Apply `supabase/migrations/202609240001_foundation.sql` through `202609240016_auth_onboarding.sql` in filename order to the demo project. Keep its RLS policies enabled.
2. Configure the Vercel project root as this Next.js directory. Set these environment variables in Vercel, never in Git:
   - `NEXT_PUBLIC_SUPABASE_URL`: demo project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: demo publishable key.
   - `SUPABASE_SERVICE_ROLE_KEY`: demo service-role key, server only.
   - `ALUNA_SITE_URL`: the final HTTPS Vercel demo origin (no path).
   - `STRIPE_SECRET_KEY`: Stripe **test** secret key.
   - `STRIPE_WEBHOOK_SECRET`: signing secret of the test-mode endpoint at `https://YOUR_DEMO_ORIGIN/api/stripe/webhook`.
3. In Supabase Auth, enable email confirmation, set the Site URL to the demo origin, and allow `https://YOUR_DEMO_ORIGIN/auth/callback` as a redirect URL. Configure an email provider able to deliver verification and recovery messages.
4. Configure Stripe test mode only; never use live keys or issue real donations from demo accounts. Configure the Customer Portal if demonstrating recurring donations.
5. Create separate demo accounts and clearly prefix their display names and organization, mission, community, fundraiser, contribution, post and proof content with `DEMO`. Never label a fabricated L3/L4 result as independently verified. Use authorized reviewers for any *actual* verification workflow demonstration; otherwise keep example proofs at L1.
6. Run `npm run build`; then verify public `/`, login, confirmation, onboarding, `/world-map`, an existing `/cities/[id]`, a demo mission and fundraising flow, referrals, proof, impact, and First 340 using browser widths for desktop, tablet and mobile. Validate unauthorized requests with separate accounts before sharing demo credentials.

The city dataset and public World Map are already present. The City Hub contains placeholder tabs; populate only existing data-backed tabs in the demo project and identify placeholders honestly.
