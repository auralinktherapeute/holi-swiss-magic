-- 1) Storage: scope private document policies to authenticated role only
drop policy if exists "docs_owner_all" on storage.objects;
create policy "docs_owner_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'therapist-docs' and (storage.foldername(name))[1] = (auth.uid())::text)
  with check (bucket_id = 'therapist-docs' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "docs_admin_read" on storage.objects;
create policy "docs_admin_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'therapist-docs' and public.is_admin(auth.uid()));

-- 2) therapist_documents: remove generic 'autre' from public showcase exposure
drop policy if exists "public read public showcase documents" on public.therapist_documents;
create policy "public read public showcase documents"
  on public.therapist_documents for select
  to anon, authenticated
  using (
    is_public = true
    and is_health_data = false
    and doc_type = any (array['diplome'::text, 'brochure'::text])
    and exists (
      select 1 from public.therapists t
      where t.id = therapist_documents.therapist_id and t.status = 'active'
    )
  );