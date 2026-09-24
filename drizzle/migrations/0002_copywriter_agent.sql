-- Agent Copywriter Actualités — dédié à « Le fil Holiswiss ».
-- Réutilise la table `articles` existante (aucune nouvelle table de contenu) :
-- seules les conversations de l'agent et deux colonnes de crédit photo/anti-spam
-- sont nouvelles. Idempotent.

-- 1. Attribution Unsplash (obligatoire selon les conditions d'utilisation de
--    l'API) — nullable : un article sans photo, ou dont la photo ne vient pas
--    d'Unsplash, n'a simplement pas de crédit à afficher.
alter table public.articles
  add column if not exists cover_image_credit_name text,
  add column if not exists cover_image_credit_url text;

-- 1bis. Motif de refus — affiché à l'admin dans l'onglet Propositions pour
--       qu'un refus ne soit pas une simple disparition silencieuse de l'article.
alter table public.articles
  add column if not exists rejection_reason text;

-- 2. Anti-spam newsletter : marque les articles du fil déjà notifiés, pour que
--    la tâche quotidienne ne renvoie jamais deux fois le même article et ne
--    regroupe que ceux réellement nouveaux depuis le dernier passage.
alter table public.articles
  add column if not exists fil_notified boolean not null default false;

create index if not exists articles_fil_notified_idx
  on public.articles (fil_notified)
  where fil_notified = false;

-- 3. Conversations de l'agent Copywriter — miroir exact de
--    marketing_agent_threads/messages, table séparée pour ne pas mélanger les
--    deux agents (l'un rédige pour les réseaux sociaux, l'autre pour le fil).
create table if not exists public.copywriter_agent_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nouvelle demande',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.copywriter_agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.copywriter_agent_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists copywriter_agent_messages_thread_idx
  on public.copywriter_agent_messages(thread_id, created_at);
create index if not exists copywriter_agent_threads_updated_idx
  on public.copywriter_agent_threads(updated_at desc);

alter table public.copywriter_agent_threads  enable row level security;
alter table public.copywriter_agent_messages enable row level security;

drop policy if exists cat_admin on public.copywriter_agent_threads;
create policy cat_admin on public.copywriter_agent_threads for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists cam_admin on public.copywriter_agent_messages;
create policy cam_admin on public.copywriter_agent_messages for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

grant select, insert, update, delete
  on public.copywriter_agent_threads, public.copywriter_agent_messages
  to authenticated, service_role;

-- 4. Déclenchement du récapitulatif quotidien « Le fil Holiswiss » — même
--    mécanisme que create_admin_notification (pg_net, endpoint + secret
--    configurables sans nouvelle migration, cf. 20260816222337).
insert into public.app_settings (key, value, updated_at)
values (
  'fil_digest_endpoint',
  to_jsonb('https://holiswiss.ch/api/public/hooks/fil-newsletter-digest'::text),
  now()
)
on conflict (key) do nothing;

-- Le secret réel est à définir une seule fois : sa valeur doit être identique
-- ici (app_settings) et dans la variable d'environnement FIL_DIGEST_SECRET
-- lue par la route qui reçoit l'appel. Laissé vide tant qu'il n'est pas
-- configuré — l'appel part alors avec un en-tête vide et la route le refuse.
insert into public.app_settings (key, value, updated_at)
values ('fil_digest_secret', to_jsonb(''::text), now())
on conflict (key) do nothing;

create or replace function public.dispatch_fil_newsletter_digest()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_endpoint text;
  v_secret text;
  v_pending int;
begin
  -- Rien à faire, rien à appeler : évite une requête HTTP quotidienne pour rien.
  select count(*) into v_pending
  from public.articles
  where fil_notified = false
    and status = 'validated'
    and category in ('fil-nouveautes','fil-actualites','fil-partenariats','fil-portraits','fil-conseils','fil-holiswiss');
  if v_pending = 0 then
    return;
  end if;

  select value #>> '{}' into v_endpoint from public.app_settings where key = 'fil_digest_endpoint';
  select value #>> '{}' into v_secret   from public.app_settings where key = 'fil_digest_secret';
  if v_endpoint is null then
    return; -- non configuré : silencieux, comme create_admin_notification
  end if;

  begin
    perform net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-agent-secret', coalesce(v_secret, '')
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise warning 'dispatch_fil_newsletter_digest: échec de mise en file : %', sqlerrm;
  end;
end;
$$;

revoke execute on function public.dispatch_fil_newsletter_digest() from public, anon, authenticated;
grant  execute on function public.dispatch_fil_newsletter_digest() to service_role;

-- 5. Planification quotidienne. 15:00 UTC = 16h/17h à Zurich selon l'heure
--    d'été — même tolérance saisonnière que le contrôle SEO (cf.
--    .github/workflows/seo-check.yml). Placé en fin de journée pour laisser
--    le temps de valider les brouillons du jour avant l'envoi.
--    pg_cron et pg_net sont déjà actifs sur ce projet (cf. 20260618090424).
select cron.unschedule(jobid) from cron.job where jobname = 'fil-newsletter-digest';
select cron.schedule(
  'fil-newsletter-digest',
  '0 15 * * *',
  $$select public.dispatch_fil_newsletter_digest()$$
);

notify pgrst, 'reload schema';
