# PR #47 migration verification

## Prepared migration

- File: `supabase/migrations/20261117024100_pr47_post_annotations.sql`
- Version: `20261117024100`
- Target project: `zujkasvuxrleisbsnrxv` (Aluna Global Network Demo)
- This is a forward migration. It has **not** been executed. No schema or data changes were made to Demo.

## Before any separately approved application

1. Confirm the GitHub PR is still #47, points to `feature/pr47-mentions-hashtags-20261117`, and remains Draft.
2. Confirm the Supabase project ref and project name are exactly `zujkasvuxrleisbsnrxv` / `Aluna Global Network Demo`.
3. Inspect all local migration filenames and verify that the Demo ledger contains `20261116153337` (`issue44_feed_public_profile_projection`).
4. Verify that `20261117024100` is unused in the Demo ledger and that there are no newer ledger entries absent from the PR branch.
5. Review the exact GitHub blob for the migration file. Record its SHA-256 before application:

   ```powershell
   Get-FileHash supabase/migrations/20261117024100_pr47_post_annotations.sql -Algorithm SHA256
   ```

6. Keep Demo read-only until the migration rehearsal has passed against an isolated database and the owner separately approves an application. Never use the older QA project as a substitute without first proving schema parity.

## Read-only ledger verification

Run from the PR branch after confirming the linked project ref. This command only lists local and remote migration versions:

```powershell
supabase migration list --linked
```

Compare the output with the GitHub branch's complete `supabase/migrations/` directory. For the prepared migration, require one exact local filename/version match and one matching remote ledger version, with no duplicate or differently named entry. Also confirm the prior `20261116153337` entry and investigate any remote version not represented in the checked-out Git history.

The equivalent database-ledger check is a read-only query:

```sql
select version, name
from supabase_migrations.schema_migrations
where version in ('20261116153337', '20261117024100')
order by version;
```

Expected after an approved application: exactly one row for `20261117024100` with the filename suffix/name `pr47_post_annotations`, and the prior `20261116153337` row remains present. Before application, absence of the new row is expected.

## Applied-schema verification after an approved application

Ledger presence alone is insufficient. Use read-only catalog queries to confirm the schema agrees with the committed file:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('posts', 'mention_refs'),
    ('scheduled_posts', 'mention_refs')
  )
order by table_name, column_name;

select to_regclass('public.post_mentions') as post_mentions,
       to_regclass('public.post_hashtags') as post_hashtags,
       to_regclass('public.post_hashtags_lookup_idx') as hashtag_lookup_index,
       to_regclass('public.notifications_one_mention_per_actor_post') as mention_dedup_index;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('post_mentions', 'post_hashtags')
order by tablename, policyname;

select p.proname, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'pr47_validate_mention_refs',
    'pr47_sync_post_annotations',
    'pr47_cleanup_post_mentions',
    'edit_scheduled_post',
    'publish_due_scheduled_posts'
  )
order by p.proname;
```

Finally record together in the PR: (1) GitHub filename and commit, (2) the SHA-256 of that exact file, (3) the Supabase ledger row, and (4) catalog evidence that the intended schema and function definitions are present. A mismatch is a no-go; do not repair the ledger or replay migrations as part of this check.
