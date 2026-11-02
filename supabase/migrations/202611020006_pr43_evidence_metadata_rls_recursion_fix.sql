-- PR43: Avoid recursive RLS between file metadata and storage.objects.
-- Narrow security-definer lookup checks only presence of the exact private
-- object after enforcing the authenticated user's uploader/contribution prefix.
create or replace function public.pr43_own_evidence_object_exists(
  p_path text, p_contribution uuid
) returns boolean
language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
    and p_contribution is not null
    and p_path like (auth.uid()::text || '/' || p_contribution::text || '/%')
    and exists(
      select 1 from storage.objects
      where bucket_id='contribution-evidence' and name=p_path
    );
$$;
revoke all on function public.pr43_own_evidence_object_exists(text,uuid) from public,anon;
grant execute on function public.pr43_own_evidence_object_exists(text,uuid) to authenticated;
drop policy if exists "PR43 evidence metadata integrity" on public.pr43_contribution_files;
create policy "PR43 evidence metadata integrity"
on public.pr43_contribution_files
as restrictive for insert to authenticated
with check (public.pr43_own_evidence_object_exists(storage_path,contribution_id));
