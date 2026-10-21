-- PR33: local-only Phase 19 media permissions and body validation assertions.
-- No browser requests, uploads, account creation or persistent mutations.
\set ON_ERROR_STOP on

do $$
declare v text; n int;
begin
 select count(*) into n from pg_policies p where p.schemaname='storage'
  and p.tablename='objects' and p.policyname like 'phase19 %'
  and p.permissive='PERMISSIVE' and 'authenticated'=any(p.roles);
 if n<>6 then raise exception 'FAIL: expected six authenticated media policies, saw %',n;end if;
 if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 profile media upload'
    and cmd='INSERT' and with_check like '%profile-media%'
    and with_check like '%foldername%' and with_check like '%auth.uid%')
 then raise exception 'FAIL: profile-media upload ownership policy missing';end if;
 if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 profile media read'
    and cmd='SELECT' and qual like '%profile-media%')
 then raise exception 'FAIL: profile-media read policy missing';end if;
 if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 post media upload'
    and cmd='INSERT' and with_check like '%post-media%'
    and with_check like '%foldername%' and with_check like '%auth.uid%')
 then raise exception 'FAIL: post-media upload policy missing';end if;
 if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 post media read'
    and cmd='SELECT' and qual like '%post-media%'
    and qual like '%can_view_post%' and qual like '%foldername%')
 then raise exception 'FAIL: post-media read policy ignores post visibility';end if;
 if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 message media upload'
    and cmd='INSERT' and with_check like '%message-media%'
    and with_check like '%can_read_conversation%' and with_check like '%auth.uid%')
 then raise exception 'FAIL: message-media upload policy ignores conversation';end if;
 if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 message media read'
    and cmd='SELECT' and qual like '%message-media%'
    and qual like '%can_read_conversation%')
 then raise exception 'FAIL: message-media read policy ignores conversation';end if;
 if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='Aluna active account required for storage'
    and permissive='RESTRICTIVE' and qual like '%aluna_is_active_account%')
 then raise exception 'FAIL: suspended users missing restrictive Storage guard';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.direct_messages'::regclass
    and conname='direct_messages_body_check' and convalidated
    and pg_get_constraintdef(oid) ilike '%media_path is not null%'
    and pg_get_constraintdef(oid) ilike '%body is not null%')
 then raise exception 'FAIL: media-only messages lack attachment/body constraint';end if;
 if exists(select 1 from storage.buckets
    where id in ('post-media','message-media') and public)
 then raise exception 'FAIL: private media bucket made public';end if;
 if (select count(*) from storage.buckets
    where id in ('profile-media','post-media','message-media'))<>3
 then raise exception 'FAIL: required media bucket missing';end if;
 if not exists(select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public' and p.proname='feed_page'
      and pg_get_functiondef(p.oid) ilike '%p.visibility%'
      and pg_get_functiondef(p.oid) ilike '%media_path%')
 then raise exception 'FAIL: Personal Timeline feed visibility or media columns missing';end if;
end $$;
\echo 'PASS: 6 Phase 19 media policies, suspension guard, private buckets, DM validation and timeline visibility'
