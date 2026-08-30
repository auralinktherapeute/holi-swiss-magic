alter table public.therapist_invoices
  add column if not exists langue text not null default 'fr';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'therapist_invoices_langue_check'
  ) then
    alter table public.therapist_invoices
      add constraint therapist_invoices_langue_check
      check (langue in ('fr','de','it','en'));
  end if;
end $$;

alter table public.therapist_invoice_settings
  add column if not exists langue_facture text not null default 'fr';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'therapist_invoice_settings_langue_check'
  ) then
    alter table public.therapist_invoice_settings
      add constraint therapist_invoice_settings_langue_check
      check (langue_facture in ('fr','de','it','en'));
  end if;
end $$;