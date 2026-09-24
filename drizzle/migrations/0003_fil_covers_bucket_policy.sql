DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='fil_covers_admin_all') THEN
    CREATE POLICY "fil_covers_admin_all" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'fil-covers' AND public.has_role(auth.uid(), 'admin'))
      WITH CHECK (bucket_id = 'fil-covers' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;