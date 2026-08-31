alter table public.appointments
  add column if not exists billing_excluded_at timestamptz,
  add column if not exists billing_exclusion_reason text,
  add column if not exists expected_price numeric(10,2);

create index if not exists idx_appointments_to_bill
  on public.appointments(therapist_id, status)
  where invoiced_at is null and billing_excluded_at is null;
