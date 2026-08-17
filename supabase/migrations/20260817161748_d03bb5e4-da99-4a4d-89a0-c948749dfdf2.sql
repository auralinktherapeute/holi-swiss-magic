-- Légende des statuts newsletter : ajout de "brief_cree" et "envoi_en_cours".
-- Idempotent : peut être relancée sans erreur même si les valeurs existent déjà.

DO $$
BEGIN
  -- Cas 1 : la colonne utilise un enum nommé "newsletter_status".
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'newsletter_status'
      AND typtype = 'e'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TYPE public.newsletter_status ADD VALUE IF NOT EXISTS ''brief_cree''';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      EXECUTE 'ALTER TYPE public.newsletter_status ADD VALUE IF NOT EXISTS ''envoi_en_cours''';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Cas 2 : la colonne est un texte avec une contrainte CHECK.
-- On recrée la contrainte pour inclure les nouvelles valeurs si elle existe.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.newsletter_issues'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
    AND pg_get_constraintdef(oid) LIKE '%idee%'
    AND pg_get_constraintdef(oid) LIKE '%envoyee%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.newsletter_issues DROP CONSTRAINT %I', constraint_name);
    EXECUTE 'ALTER TABLE public.newsletter_issues ADD CONSTRAINT ' || constraint_name || ' CHECK (status IN (''idee'', ''brief_cree'', ''brouillon'', ''en_revision'', ''approuvee'', ''programmee'', ''envoi_en_cours'', ''envoyee'', ''echec'', ''archivee''))';
  END IF;
END $$;