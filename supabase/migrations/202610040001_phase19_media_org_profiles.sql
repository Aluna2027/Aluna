-- Phase 19: media uploads and company benchmark profile fields.
alter table public.organizations
  add column if not exists wba_total_score numeric(3,1),
  add column if not exists wba_human_rights_score numeric(3,1),
  add column if not exists wba_decent_work_score numeric(3,1),
  add column if not exists wba_acting_ethically_score numeric(3,1);

alter table public.posts add column if not exists media_path text;
alter table public.posts add column if not exists media_type text;
alter table public.direct_messages add column if not exists media_path text;
alter table public.direct_messages add column if not exists media_type text;
alter table public.direct_messages alter column body drop not null;
grant update (wba_total_score,wba_human_rights_score,wba_decent_work_score,wba_acting_ethically_score) on public.organizations to authenticated;
grant update (media_path,media_type) on public.posts to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
 ('profile-media','profile-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']),
 ('post-media','post-media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
 ('message-media','message-media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

-- Live database also has Phase 19 range constraints, storage RLS policies,
-- nullable message-body/media checks, and feed_page media columns applied
-- through the matching Phase 19 Supabase migrations.
