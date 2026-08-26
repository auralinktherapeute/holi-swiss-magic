-- ============================================================
-- L0 : sécurité / RGPD  +  L1 : pivot rendez-vous ↔ client
-- Idempotent.
-- ============================================================

-- 1) Secret professionnel : plus d'accès admin aux notes de séance
drop policy if exists "Therapist manages own session notes" on public.crm_session_notes;
create policy "Therapist manages own session notes"
  on public.crm_session_notes for all to authenticated
  using (public.is_therapist_owner(therapist_id))
  with check (public.is_therapist_owner(therapist_id));

-- 2) Documents : typage, rattachement client, santé, auteur
alter table public.therapist_documents
  add column if not exists client_id uuid references public.crm_client_contacts(id) on delete set null,
  add column if not exists doc_type text not null default 'autre',
  add column if not exists is_health_data boolean not null default false,
  add column if not exists created_by uuid;

alter table public.therapist_documents alter column is_public set default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'therapist_documents_doc_type_chk'
      and conrelid = 'public.therapist_documents'::regclass
  ) then
    alter table public.therapist_documents
      add constraint therapist_documents_doc_type_chk
      check (doc_type in ('diplome','brochure','certificat','compte_rendu','bilan','ordonnance','facture','autre'));
  end if;

  -- Une donnée de santé ne peut jamais être publique
  if not exists (
    select 1 from pg_constraint
    where conname = 'therapist_documents_health_not_public_chk'
      and conrelid = 'public.therapist_documents'::regclass
  ) then
    alter table public.therapist_documents
      add constraint therapist_documents_health_not_public_chk
      check (not (is_public and is_health_data));
  end if;
end $$;

drop policy if exists "public read public documents" on public.therapist_documents;
create policy "public read public showcase documents"
  on public.therapist_documents for select to anon, authenticated
  using (
    is_public = true
    and is_health_data = false
    and doc_type in ('diplome','brochure','autre')
    and exists (
      select 1 from public.therapists t
      where t.id = therapist_documents.therapist_id and t.status = 'active'
    )
  );

-- 3) Consentement RGPD / nLPD sur les fiches clients
alter table public.crm_client_contacts
  add column if not exists consent_at timestamptz,
  add column if not exists consent_source text,
  add column if not exists legal_basis text not null default 'contract',
  add column if not exists retention_until date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'crm_client_contacts_legal_basis_chk'
      and conrelid = 'public.crm_client_contacts'::regclass
  ) then
    alter table public.crm_client_contacts
      add constraint crm_client_contacts_legal_basis_chk
      check (legal_basis in ('consent','contract','legal_obligation','vital_interest'));
  end if;
end $$;

-- 4) Journal d'accès aux données sensibles
create table if not exists public.crm_access_log (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  actor_user_id uuid not null,
  entity_type text not null check (entity_type in ('client','session_note','document','invoice','export')),
  entity_id uuid,
  action text not null check (action in ('read','create','update','delete','export','send')),
  context text,
  occurred_at timestamptz not null default now()
);

grant select, insert on public.crm_access_log to authenticated;
grant all on public.crm_access_log to service_role;

alter table public.crm_access_log enable row level security;

drop policy if exists "Therapist reads own access log" on public.crm_access_log;
create policy "Therapist reads own access log"
  on public.crm_access_log for select to authenticated
  using (public.is_therapist_owner(therapist_id) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Therapist writes own access log" on public.crm_access_log;
create policy "Therapist writes own access log"
  on public.crm_access_log for insert to authenticated
  with check (public.is_therapist_owner(therapist_id) and actor_user_id = auth.uid());
-- Pas de policy UPDATE/DELETE : journal en append-only.

create index if not exists idx_crm_access_log_therapist_date
  on public.crm_access_log (therapist_id, occurred_at desc);

-- 5) Pivot : rendez-vous ↔ client ↔ facture
alter table public.appointments
  add column if not exists client_id uuid references public.crm_client_contacts(id) on delete set null,
  add column if not exists invoiced_at timestamptz,
  add column if not exists invoice_id uuid references public.therapist_invoices(id) on delete set null;

-- Backfill : email exact, puis téléphone (chiffres uniquement), par thérapeute
update public.appointments a
set client_id = c.id
from public.crm_client_contacts c
where a.client_id is null
  and a.therapist_id = c.therapist_id
  and a.patient_email is not null
  and c.email is not null
  and lower(trim(a.patient_email)) = lower(trim(c.email));

update public.appointments a
set client_id = c.id
from public.crm_client_contacts c
where a.client_id is null
  and a.therapist_id = c.therapist_id
  and a.patient_phone is not null
  and c.phone is not null
  and regexp_replace(a.patient_phone, '\D', '', 'g') <> ''
  and regexp_replace(a.patient_phone, '\D', '', 'g') = regexp_replace(c.phone, '\D', '', 'g');

-- 6) Index de performance
create index if not exists idx_appointments_therapist_date
  on public.appointments (therapist_id, appointment_date desc);
create index if not exists idx_appointments_client
  on public.appointments (client_id);
create index if not exists idx_appointments_uninvoiced
  on public.appointments (therapist_id, status) where invoiced_at is null;
create index if not exists idx_crm_client_contacts_therapist_name
  on public.crm_client_contacts (therapist_id, last_name, first_name);
create index if not exists idx_therapist_invoices_therapist_status
  on public.therapist_invoices (therapist_id, statut, date_emission desc);
create index if not exists idx_therapist_invoice_payments_invoice
  on public.therapist_invoice_payments (invoice_id, date_paiement desc);
create index if not exists idx_therapist_documents_client
  on public.therapist_documents (therapist_id, client_id, doc_type);
create index if not exists idx_crm_tasks_therapist_due
  on public.crm_tasks (therapist_id, done, due_at);