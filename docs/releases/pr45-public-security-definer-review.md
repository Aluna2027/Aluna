# PR #45 release: public SECURITY DEFINER RPC review (read-only)

Date: 2026-11-08. Inspected **live definitions**, triggers, table privileges and policies of shared Supabase Demo `zujkasvuxrleisbsnrxv`. No SQL was executed to modify shared data/schema. This documents a security review, not penetration testing.

## Four anonymously executable functions

| Function | Live behavior | Exposure and assessment |
|---|---|---|
| `public.aluna_require_active_data_api_session()` | Returns void. If request JWT role is not `authenticated`, returns; otherwise checks `auth.uid()` is an existing, unbanned `auth.users` row and raises 42501 if not. | Anonymous EXECUTE present; no write operations; designed as a gateway guard. **No obvious privilege escalation from code inspected.** Exposure not automatically a vulnerability. |
| `public.create_profile()` | `RETURNS trigger`; inserts profile for `NEW.id` and `NEW.email` into `public.profiles`. | Trigger attached to `auth.users` (`on_auth_user_created`), despite anonymous EXECUTE grant. PostgreSQL trigger-returning functions are not ordinarily callable directly as a standalone SQL RPC. Existing anon grant is unnecessary in principle; **no standalone privilege escalation confirmed**, but consider reducing privilege after isolated trigger regression tests. |
| `public.visit_campaign_referral(text,text)` | Whitelists source values, looks up token for active campaign whose linked campaign is not archived/removed, increments `campaign_referral_source_counts.clicks`, returns campaign ID. | Anonymous access is intentional for public campaign tracking. `campaign_referral_source_counts` has RLS and no anon direct INSERT/UPDATE. **Integrity concern:** function itself has no rate limiting or unique-visit requirement; repeated calls with a token/source increment count. No authorization escalation observed. |
| `public.visit_fundraiser_referral(text,text)` | Whitelists source, looks up legacy fundraiser token and increments `referral_source_counts.clicks`, returns fundraiser slug. | Anonymous tracking appears intentional for legacy URLs. **Integrity concern:** similarly lacks per-visitor dedupe/rate control and accepts repeated calls; relies on caller/app protections if any. Historical `fundraiser_referral_links` and `referral_source_counts` tables have anon grants but no INSERT/UPDATE anon RLS policies; current effective row access must be evaluated under real PostgREST credentials before making a categorical security claim. |

## Additional observations

- All four functions are `SECURITY DEFINER` with `search_path = ''`, and use explicitly qualified table names where relevant.
- Of the four, only `create_profile()` is attached as a database trigger (`auth.users`); the other three are public SQL functions.
- Referral source strings are restricted to `direct, whatsapp, facebook, instagram, linkedin, x, tiktok, telegram, email, qr, copy`; this prevents arbitrary source values, **not repeat-count inflation**.
- Examined `public` RLS policies for campaign and legacy referral tables. New campaign referral links use actor authorization on create/update, while legacy fundraiser referral links expose public SELECT.
- No write operations were executed, no abuse traffic generated, and no live rate-limit experiment was attempted. Thus exploitability or actual inflated counters is **unproven**.
- Further check Next.js application endpoint throttling, URL validation and proxy/API gateway protections. Consider deduplication or per-visitor rate controls under a separate PR. Do not modify referral counts or revoke required public access in PR45 without backward-compatibility tests.
- These pre-existing functions **do not form part of the PR45 direct L4 approval path**; do not misclassify them as proof that the new L4 RPC is unsafe.

## Release disposition

- **Code-level review completed** for these four accessible routines. No confirmed privilege-escalation bug in reviewed function bodies.
- **Follow-up warranted:** referral metrics abuse resistance and legacy referral access, tracked separately from the approved PR45 L4 functionality.
- **PR45 release still blocked** by issue #44 ledger repair strategy, backup restore confidence, independent CI/mobile QA and explicit authorization to change shared Demo / merge. Do not apply an automatic migration push.
