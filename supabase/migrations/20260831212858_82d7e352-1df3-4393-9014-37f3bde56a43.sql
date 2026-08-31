-- Lot A : fondations additives et idempotentes

alter table public.crm_client_contacts
  add column if not exists preferred_document_language text not null default 'fr';

alter table public.therapist_invoice_lines
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists tariff_system text,
  add column if not exists tariff_code text,
  add column if not exists tariff_label text,
  add column if not exists tariff_version text,
  add column if not exists unite text,
  add column if not exists duree_min integer,
  add column if not exists commentaire text;

alter table public.therapist_invoice_settings
  add column if not exists taux_tva_autorises numeric[] not null default array[0, 2.6, 3.8, 8.1]::numeric[],
  add column if not exists autoriser_taux_personnalise boolean not null default false,
  add column if not exists use_tarif_590 boolean not null default false,
  add column if not exists comptable_email text,
  add column if not exists comptable_nom text;

-- Protection anti double facturation d'un rendez-vous (les factures annulées / avoirs libèrent le RDV)
create or replace function public.therapist_invoice_lines_no_double_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.appointment_id is null then
    return new;
  end if;
  if exists (
    select 1
    from public.therapist_invoice_lines l
    join public.therapist_invoices i on i.id = l.invoice_id
    where l.appointment_id = new.appointment_id
      and l.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and i.statut not in ('annulee', 'avoir')
  ) then
    raise exception 'Ce rendez-vous est déjà rattaché à une facture active.'
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.therapist_invoice_lines_no_double_billing() from public, anon, authenticated;

drop trigger if exists trg_invoice_lines_no_double_billing on public.therapist_invoice_lines;
create trigger trg_invoice_lines_no_double_billing
  before insert or update of appointment_id on public.therapist_invoice_lines
  for each row execute function public.therapist_invoice_lines_no_double_billing();

-- Historique des statuts de facture
create table if not exists public.invoice_status_history (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.therapist_invoices(id) on delete cascade,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  previous_status text,
  new_status text not null,
  reason text,
  note text,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select, insert on public.invoice_status_history to authenticated;
grant all on public.invoice_status_history to service_role;
alter table public.invoice_status_history enable row level security;

drop policy if exists "invoice_status_history_owner" on public.invoice_status_history;
create policy "invoice_status_history_owner" on public.invoice_status_history
  for select to authenticated
  using (public.is_therapist_owner(therapist_id));

drop policy if exists "invoice_status_history_insert" on public.invoice_status_history;
create policy "invoice_status_history_insert" on public.invoice_status_history
  for insert to authenticated
  with check (public.is_therapist_owner(therapist_id));

-- Exports comptables
create table if not exists public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  export_type text not null,
  period_start date not null,
  period_end date not null,
  file_names jsonb not null default '[]'::jsonb,
  invoice_count integer not null default 0,
  payment_count integer not null default 0,
  total_size_bytes bigint,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on public.accounting_exports to authenticated;
grant all on public.accounting_exports to service_role;
alter table public.accounting_exports enable row level security;

drop policy if exists "accounting_exports_owner" on public.accounting_exports;
create policy "accounting_exports_owner" on public.accounting_exports
  for select to authenticated
  using (public.is_therapist_owner(therapist_id));

drop policy if exists "accounting_exports_insert" on public.accounting_exports;
create policy "accounting_exports_insert" on public.accounting_exports
  for insert to authenticated
  with check (public.is_therapist_owner(therapist_id));

drop trigger if exists trg_accounting_exports_updated_at on public.accounting_exports;
create trigger trg_accounting_exports_updated_at
  before update on public.accounting_exports
  for each row execute function public.update_updated_at_column();

-- Historique d'envoi d'e-mails transactionnels
create table if not exists public.email_send_history (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references public.therapists(id) on delete cascade,
  client_id uuid references public.crm_client_contacts(id) on delete set null,
  invoice_id uuid references public.therapist_invoices(id) on delete set null,
  accounting_export_id uuid references public.accounting_exports(id) on delete set null,
  email_type text not null,
  resend_email_id text,
  from_email text,
  from_name text,
  reply_to text,
  to_email text not null,
  subject text,
  language text,
  attachment_names jsonb not null default '[]'::jsonb,
  status text not null default 'queued',
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.email_send_history to authenticated;
grant all on public.email_send_history to service_role;
alter table public.email_send_history enable row level security;

drop policy if exists "email_send_history_owner" on public.email_send_history;
create policy "email_send_history_owner" on public.email_send_history
  for select to authenticated
  using (public.is_therapist_owner(therapist_id));

drop trigger if exists trg_email_send_history_updated_at on public.email_send_history;
create trigger trg_email_send_history_updated_at
  before update on public.email_send_history
  for each row execute function public.update_updated_at_column();

-- Index de performance
create index if not exists idx_invoice_lines_appointment on public.therapist_invoice_lines(appointment_id) where appointment_id is not null;
create index if not exists idx_invoices_client on public.therapist_invoices(client_id);
create index if not exists idx_invoices_therapist_statut on public.therapist_invoices(therapist_id, statut);
create index if not exists idx_invoices_date_emission on public.therapist_invoices(therapist_id, date_emission);
create index if not exists idx_invoices_date_echeance on public.therapist_invoices(therapist_id, date_echeance);
create index if not exists idx_invoice_payments_date on public.therapist_invoice_payments(therapist_id, date_paiement);
create index if not exists idx_invoice_status_history_invoice on public.invoice_status_history(invoice_id, changed_at desc);
create index if not exists idx_email_send_history_invoice on public.email_send_history(invoice_id, created_at desc);
create index if not exists idx_email_send_history_resend on public.email_send_history(resend_email_id) where resend_email_id is not null;
create index if not exists idx_accounting_exports_therapist on public.accounting_exports(therapist_id, created_at desc);
create index if not exists idx_crm_contacts_therapist on public.crm_client_contacts(therapist_id);
create index if not exists idx_appointments_client on public.appointments(client_id);
