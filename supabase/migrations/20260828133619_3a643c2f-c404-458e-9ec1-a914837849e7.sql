do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='invoice_logos_owner_all') then
    create policy "invoice_logos_owner_all" on storage.objects
      for all to authenticated
      using (bucket_id = 'invoice-logos' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'invoice-logos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;