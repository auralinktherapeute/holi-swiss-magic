
CREATE OR REPLACE FUNCTION public.trg_notify_article_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NEW.status = 'pending_validation' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM public.create_admin_notification(
        'article_pending',
        'Nouvel article en attente',
        COALESCE(NEW.title_fr, NEW.meta_title_fr, NEW.slug, '(sans titre)'),
        '/admin/articles?status=pending_validation',
        'article', NEW.id,
        '{}'::jsonb
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_notify_article_pending failed (ignored): %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
