DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'therapists'
    AND column_name NOT IN (
      'status','verified','ide_verified','siret_verified','subscription_plan',
      'verification_status','verified_at','verification_notes',
      'newsletter_opt_in','newsletter_opt_in_at','newsletter_unsubscribed_at',
      'newsletter_consent_source','newsletter_consent_version',
      'newsletter_consent_email','newsletter_unsubscribe_token'
    );

  EXECUTE 'REVOKE UPDATE ON public.therapists FROM authenticated';
  EXECUTE 'REVOKE UPDATE ON public.therapists FROM anon';
  EXECUTE format('GRANT UPDATE (%s) ON public.therapists TO authenticated', cols);
END $$;

GRANT ALL ON public.therapists TO service_role;