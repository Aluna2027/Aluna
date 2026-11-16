-- PR45 read-only restoration parity test. Run separately on source and restored isolated target.
-- Never use these hashes as a backup or as proof of data-level equality.
WITH objects AS (
  SELECT 'public_columns' AS category, c.relname||'.'||a.attname AS identity,
         concat_ws('|',a.attnum,format_type(a.atttypid,a.atttypmod),a.attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),'')) AS definition
  FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
  LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'public_constraints',c.relname||'.'||con.conname,pg_get_constraintdef(con.oid)
  FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid WHERE c.relnamespace='public'::regnamespace
  UNION ALL
  SELECT 'public_functions',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_functiondef(p.oid)
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
  UNION ALL
  SELECT 'public_rls_flags',c.relname,c.relrowsecurity::text||'|'||c.relforcerowsecurity::text
  FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
  UNION ALL
  SELECT 'public_and_storage_policies',schemaname||'.'||tablename||'.'||policyname,
         concat_ws('|',permissive,roles::text,cmd,coalesce(qual,''),coalesce(with_check,''))
  FROM pg_policies WHERE schemaname IN ('public','storage')
  UNION ALL
  SELECT 'public_triggers',c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
  UNION ALL
  SELECT 'public_table_acl',c.relname,concat_ws('|',coalesce(c.relacl::text,''),
         has_table_privilege('anon',c.oid,'SELECT'),has_table_privilege('authenticated',c.oid,'SELECT'),
         has_table_privilege('anon',c.oid,'INSERT'),has_table_privilege('authenticated',c.oid,'INSERT'))
  FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v')
  UNION ALL
  SELECT 'public_function_acl',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
         concat_ws('|',coalesce(p.proacl::text,''),has_function_privilege('anon',p.oid,'EXECUTE'),
         has_function_privilege('authenticated',p.oid,'EXECUTE'))
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
  UNION ALL
  SELECT 'extensions',extname,extversion||'|'||extnamespace::regnamespace::text FROM pg_extension
)
SELECT category,count(*)::int AS item_count,
       md5(coalesce(string_agg(identity||'='||definition,E'\n' ORDER BY identity),'')) AS catalog_fingerprint
FROM objects GROUP BY category
UNION ALL SELECT 'auth_user_count',count(*)::int,NULL::text FROM auth.users
UNION ALL SELECT 'storage_object_count',count(*)::int,NULL::text FROM storage.objects
UNION ALL SELECT 'migration_ledger_count',count(*)::int,NULL::text FROM supabase_migrations.schema_migrations
ORDER BY category;
