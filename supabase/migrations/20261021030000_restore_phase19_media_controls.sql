-- PR33 P1: forward-only backfill of Phase 19 media authorization omitted from Git.
-- Existing Demo policies are preserved; this migration creates missing policies only.
-- No bucket contents or user data are modified. No scheduled publisher is activated.
-- Base table columns, buckets, and later document MIME types already exist in GitHub.
-- Preserve the final Personal Timeline feed_page definition from 202610130003.

-- Media-only direct messages must not permit an empty message with no attachment.
-- Existing non-empty messages continue to satisfy the replacement constraint.
alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages add constraint direct_messages_body_check
 check ((body is not null and char_length(body) between 1 and 4000) or media_path is not null);

-- Avoid overwriting any policy already applied in a target environment.
-- CI asserts the existing rules match the intended final authorization conditions.

do $pr33_media_1$
begin
 if not exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 profile media upload') then
   create policy "phase19 profile media upload" on storage.objects for insert to authenticated
    with check (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text);
 end if;
end $pr33_media_1$;

do $pr33_media_2$
begin
 if not exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 profile media read') then
   create policy "phase19 profile media read" on storage.objects for select to authenticated
    using (bucket_id='profile-media');
 end if;
end $pr33_media_2$;

do $pr33_media_3$
begin
 if not exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 post media upload') then
   create policy "phase19 post media upload" on storage.objects for insert to authenticated
    with check (bucket_id='post-media' and (storage.foldername(name))[1]=auth.uid()::text);
 end if;
end $pr33_media_3$;

do $pr33_media_4$
begin
 if not exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 post media read') then
   create policy "phase19 post media read" on storage.objects for select to authenticated
    using (bucket_id='post-media' and array_length(storage.foldername(name),1)>=2 and public.can_view_post(((storage.foldername(name))[2])::uuid));
 end if;
end $pr33_media_4$;

do $pr33_media_5$
begin
 if not exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 message media upload') then
   create policy "phase19 message media upload" on storage.objects for insert to authenticated
    with check (bucket_id='message-media' and (storage.foldername(name))[1]=auth.uid()::text and array_length(storage.foldername(name),1)>=2 and public.can_read_conversation(((storage.foldername(name))[2])::uuid));
 end if;
end $pr33_media_5$;

do $pr33_media_6$
begin
 if not exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='phase19 message media read') then
   create policy "phase19 message media read" on storage.objects for select to authenticated
    using (bucket_id='message-media' and array_length(storage.foldername(name),1)>=2 and public.can_read_conversation(((storage.foldername(name))[2])::uuid));
 end if;
end $pr33_media_6$;
