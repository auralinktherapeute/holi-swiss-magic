-- `app_settings` est référencée par plusieurs migrations depuis fin juin
-- (endpoint/secret admin-notify, endpoint/secret fil-newsletter-digest...)
-- mais n'a jamais été créée par une migration versionnée elle-même — elle
-- l'avait été directement en base. Cette migration comble ce trou pour que
-- l'historique redevienne rejouable de zéro. Idempotent.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Cette table stocke des secrets de webhooks en clair (valeur `value`) : RLS
-- activé sans policy anon/authenticated. Seuls service_role et les fonctions
-- `security definer` (create_admin_notification, dispatch_fil_newsletter_digest…)
-- y accèdent — ces dernières s'exécutent en tant que propriétaire de la table,
-- qui n'est pas soumis à RLS.
alter table public.app_settings enable row level security;

grant select, insert, update, delete on public.app_settings to service_role;
