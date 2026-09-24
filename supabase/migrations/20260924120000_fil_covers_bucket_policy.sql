-- Policy d'accès pour le bucket `fil-covers` (photos de couverture du fil
-- Holiswiss uploadées par l'admin depuis l'agent Copywriter, en alternative
-- aux suggestions Unsplash).
--
-- NB : la création du bucket lui-même (privé, images uniquement, 5 Mo max)
-- se fait hors migration, via l'outil storage dédié — les écritures dans
-- storage.buckets sont rejetées (cf. 20260727090000_therapist_health_agent).
-- Même schéma que org_logos_admin_all (20260911100554).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='fil_covers_admin_all') THEN
    CREATE POLICY "fil_covers_admin_all" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'fil-covers' AND public.has_role(auth.uid(), 'admin'))
      WITH CHECK (bucket_id = 'fil-covers' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
