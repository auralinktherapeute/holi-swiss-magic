REVOKE ALL ON FUNCTION public.trg_notify_article_pending() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_notify_article_pending() FROM anon;
REVOKE ALL ON FUNCTION public.trg_notify_article_pending() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trg_notify_article_pending() TO service_role;