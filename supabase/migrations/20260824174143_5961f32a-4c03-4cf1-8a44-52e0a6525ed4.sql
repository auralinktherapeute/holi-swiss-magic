-- ============================================================================
-- Notification admin — rétablir un canal appelable par les agents
--
-- PROBLÈME (diagnostiqué le 24/08/2026)
--   La migration de durcissement 20260816215809 a révoqué EXECUTE à `anon` sur
--   `create_admin_notification`, et 20260816222337 l'a ré-affirmé. C'est JUSTE :
--   la fonction écrit une notification et déclenche un http_post sortant sans
--   aucune garde — l'ouvrir à anon, c'est offrir un relais de spam.
--
--   Mais deux appelants légitimes l'utilisaient avec la clé anon :
--     * la tâche planifiée `holiswiss-indexation-quotidienne` (rapport quotidien)
--     * l'edge function gpld `run-indexation` (bouton /admin/indexation)
--   Les deux reçoivent 401 depuis le 16/08. Pire, `run-indexation` ne vérifiait
--   pas le statut HTTP : l'échec est resté SILENCIEUX huit jours.
--
-- SOLUTION — ne pas rouvrir anon sur la fonction nue.
--   On expose une façade `request_admin_notification` gardée par un secret
--   partagé, exactement le motif déjà éprouvé pour le pipeline marketing
--   (20260801230000) : le secret est le garde, la clé anon ne suffit pas.
--   Le périmètre est volontairement étroit : uniquement kind/subject/summary/link,
--   pas d'entity_id ni de _data arbitraire.
--
-- Idempotente : rejouable sans effet de bord.
-- À appliquer via Lovable (jamais d'écriture directe sur qqwud).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Secret partagé
--
--    Amorcé depuis `marketing_agent_secret` quand il existe : c'est la MÊME
--    frontière de confiance (le pipeline Claude Code local, dont le secret vit
--    déjà dans .env.local), ce qui évite un aller-retour manuel par le dashboard
--    Supabase pour récupérer une valeur fraîche. À défaut, valeur aléatoire.
--
--    Rotation indépendante quand souhaité :
--      update public.app_settings
--         set value = to_jsonb(encode(gen_random_bytes(32),'hex')), updated_at = now()
--       where key = 'agent_notify_secret';
--    (puis reporter la nouvelle valeur dans .env.local et seo_admin_secrets/gpld)
-- ----------------------------------------------------------------------------
insert into public.app_settings (key, value, updated_at)
select 'agent_notify_secret',
       coalesce(
         (select value from public.app_settings where key = 'marketing_agent_secret'),
         to_jsonb(encode(gen_random_bytes(32), 'hex'))
       ),
       now()
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Vérification du secret — comparaison sur digests de longueur fixe
--    (`=` sur text sort au premier octet différent et fuit la longueur du
--    préfixe correct — même précaution que marketing_agent_secret_ok).
-- ----------------------------------------------------------------------------
create or replace function public.agent_notify_secret_ok(_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_attendu text;
begin
  if _secret is null or length(_secret) = 0 then
    return false;
  end if;
  select value #>> '{}' into v_attendu from public.app_settings where key = 'agent_notify_secret';
  if v_attendu is null then
    return false;
  end if;
  return encode(digest(_secret, 'sha256'), 'hex') = encode(digest(v_attendu, 'sha256'), 'hex');
end;
$$;

revoke execute on function public.agent_notify_secret_ok(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) Façade gardée
--
--    SECURITY DEFINER : s'exécute au nom du propriétaire, qui conserve le droit
--    d'appeler `create_admin_notification` malgré le REVOKE sur anon. Le seul
--    sésame est le secret.
-- ----------------------------------------------------------------------------
create or replace function public.request_admin_notification(
  _secret  text,
  _kind    text,
  _subject text,
  _summary text,
  _link    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if not public.agent_notify_secret_ok(_secret) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if _kind is null or length(trim(_kind)) = 0
     or _subject is null or length(trim(_subject)) = 0 then
    raise exception 'kind et subject sont obligatoires' using errcode = '22023';
  end if;

  -- Garde-fou anti-emballement : un agent en boucle ne doit pas pouvoir
  -- inonder la boîte de Gérald. 12 notifications/heure suffisent largement
  -- (le dispositif d'indexation en produit 1 à 2 par jour).
  if (select count(*) from public.notifications
       where created_at > now() - interval '1 hour') >= 12 then
    raise exception 'quota de notifications atteint pour cette heure'
      using errcode = '53400';
  end if;

  v_id := public.create_admin_notification(
    _kind    => _kind,
    _subject => _subject,
    _summary => _summary,
    _link    => _link
  );

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Droits — le secret est le garde, pas le rôle.
--    Cette façade DOIT être appelable avec la clé anon : c'est tout son objet.
--    `create_admin_notification` reste, elle, fermée à anon.
-- ----------------------------------------------------------------------------
revoke execute on function public.request_admin_notification(text, text, text, text, text) from public;
grant  execute on function public.request_admin_notification(text, text, text, text, text)
  to anon, authenticated, service_role;

comment on function public.request_admin_notification(text, text, text, text, text) is
  'Façade de notification pour les agents (indexation, pipelines Claude Code). Protégée par agent_notify_secret — la clé anon seule ne suffit pas. create_admin_notification reste fermée à anon (durcissement du 16/08).';