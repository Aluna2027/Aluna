-- PR #43: Evidence metadata must refer to a real object uploaded by the
-- current authenticated user for this exact contribution.
-- The existing permissive policies continue to authorize contributor, L2,
-- assigned L3 reviewer, and Aluna admin; this RESTRICTIVE INSERT policy must
-- also pass.  The API already uploads to this prefix before inserting metadata.
-- No existing evidence rows or objects are modified.
create policy "PR43 evidence metadata integrity"
on public.pr43_contribution_files
as restrictive for insert to authenticated
with check (
  storage_path like (auth.uid()::text || '/' || contribution_id::text || '/%')
  and exists (
    select 1 from storage.objects obj
    where obj.bucket_id='contribution-evidence'
      and obj.name=pr43_contribution_files.storage_path
  )
);
