-- Fiabilise la notification admin (public.create_admin_notification) :
--   1. Endpoint configurable  : l'URL Lovable, jusqu'ici codée en dur (URL de
--      préversion instable), passe dans app_settings.admin_notify_endpoint.
--      Si l'URL change, il suffit d'un UPDATE d'une ligne — plus de migration.
--   2. Échec traçable         : net.http_post (pg_net) est ASYNCHRONE — il met la
--      requête en file et rend la main ; l'EXCEPTION n'attrape donc PAS un 500 de
--      l'endpoint, seulement une erreur de mise en file. Le vrai statut de livraison
--      vit dans net._http_response, indexé par le request_id. On capture ce
--      request_id sur la notification (colonne dispatch_request_id) pour pouvoir
--      corréler et voir les livraisons échouées, au lieu d'un RAISE NOTICE volatil.
--
-- Idempotent. À appliquer via Lovable. Ne modifie ni la signature ni la logique
-- d'insertion de la notification (l'affichage in-app reste inchangé).

-- 1. Endpoint dans app_settings (valeur initiale = URL actuelle, ne pas écraser si présente)
insert into public.app_settings (key, value, updated_at)
values (
  'admin_notify_endpoint',
  to_jsonb('https://project--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app/api/public/admin-notify'::text),
  now()
)
on conflict (key) do nothing;

-- 2. Colonne de traçabilité du dispatch (request_id pg_net)
alter table public.notifications
  add column if not exists dispatch_request_id bigint;

comment on column public.notifications.dispatch_request_id is
  'ID de requête pg_net du webhook admin-notify. Joindre à net._http_response pour le statut de livraison.';

-- 3. Redéfinition : endpoint depuis app_settings, capture du request_id, échec visible
create or replace function public.create_admin_notification(
  _kind text, _subject text, _summary text,
  _link text default null::text, _entity_type text default null::text,
  _entity_id uuid default null::uuid, _data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_id uuid;
  v_endpoint text;
  v_secret text;
  v_req bigint;
begin
  insert into public.notifications (kind, subject, summary, link, entity_type, entity_id, data)
  values (_kind, _subject, _summary, _link, _entity_type, _entity_id, coalesce(_data,'{}'::jsonb))
  on conflict (kind, entity_type, entity_id) where entity_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    return null;  -- doublon dédupliqué : rien à dispatcher
  end if;

  -- Configuration lue depuis app_settings (repli sur l'URL historique si la clé manque)
  select value #>> '{}' into v_endpoint from public.app_settings where key = 'admin_notify_endpoint';
  v_endpoint := coalesce(v_endpoint,
    'https://project--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app/api/public/admin-notify');
  select value #>> '{}' into v_secret from public.app_settings where key = 'admin_notify_secret';

  begin
    v_req := net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-admin-notify-secret', coalesce(v_secret,'')
      ),
      body := jsonb_build_object(
        'notification_id', v_id,
        'kind', _kind,
        'subject', _subject,
        'summary', _summary,
        'link', _link
      )
    );
    -- Trace : permet de retrouver le statut réel dans net._http_response
    update public.notifications set dispatch_request_id = v_req where id = v_id;
  exception when others then
    -- Échec de MISE EN FILE (pas de livraison) : visible dans les logs Postgres.
    raise warning 'admin-notify: échec de mise en file pour notification % : %', v_id, sqlerrm;
  end;

  return v_id;
end $function$;

-- 4. Verrou de sécurité ré-affirmé (create or replace ne réinitialise pas l'ACL,
--    mais on le rejoue pour que la migration soit autonome — cf. 20260816215809).
revoke execute on function public.create_admin_notification(text, text, text, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant  execute on function public.create_admin_notification(text, text, text, text, text, uuid, jsonb)
  to service_role;