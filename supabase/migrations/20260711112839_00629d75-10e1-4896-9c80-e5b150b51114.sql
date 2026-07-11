
ALTER TABLE public.therapist_documents ALTER COLUMN is_public SET DEFAULT false;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('admin_notify_secret', to_jsonb(encode(gen_random_bytes(32), 'hex')), now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _kind text, _subject text, _summary text,
  _link text DEFAULT NULL::text, _entity_type text DEFAULT NULL::text,
  _entity_id uuid DEFAULT NULL::uuid, _data jsonb DEFAULT '{}'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_id uuid;
  v_endpoint text := 'https://project--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app/api/public/admin-notify';
  v_secret text;
BEGIN
  INSERT INTO public.notifications (kind, subject, summary, link, entity_type, entity_id, data)
  VALUES (_kind, _subject, _summary, _link, _entity_type, _entity_id, COALESCE(_data,'{}'::jsonb))
  ON CONFLICT (kind, entity_type, entity_id) WHERE entity_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT value #>> '{}' INTO v_secret FROM public.app_settings WHERE key = 'admin_notify_secret';

  BEGIN
    PERFORM net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-admin-notify-secret', COALESCE(v_secret,'')
      ),
      body := jsonb_build_object(
        'notification_id', v_id,
        'kind', _kind,
        'subject', _subject,
        'summary', _summary,
        'link', _link
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'admin-notify dispatch failed: %', SQLERRM;
  END;

  RETURN v_id;
END $function$;
