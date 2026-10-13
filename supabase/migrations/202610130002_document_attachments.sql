-- Allow a document as the existing single attachment type.
alter table public.posts drop constraint if exists posts_media_type_check;
alter table public.posts add constraint posts_media_type_check check(media_type is null or media_type in ('image','video','document'));
alter table public.direct_messages drop constraint if exists direct_messages_media_type_check;
alter table public.direct_messages add constraint direct_messages_media_type_check check(media_type is null or media_type in ('image','video','document'));

-- Keep both buckets private and retain the existing 50 MB limit.
update storage.buckets
set allowed_mime_types=ARRAY[
 'image/jpeg','image/png','image/webp','image/gif',
 'video/mp4','video/webm','video/quicktime',
 'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
]
where id in ('post-media','message-media');
