drop policy if exists "Public read active packages" on public.service_packages;
create policy "Public read active packages"
  on public.service_packages for select
  to anon, authenticated
  using (
    actif = true
    and exists (
      select 1 from public.therapists t
      where t.id = service_packages.therapist_id and t.status = 'active'
    )
  );

drop policy if exists "Public read active questionnaires" on public.questionnaires;
create policy "Public read active questionnaires"
  on public.questionnaires for select
  to anon, authenticated
  using (
    actif = true
    and exists (
      select 1 from public.therapists t
      where t.id = questionnaires.therapist_id and t.status = 'active'
    )
  );

drop policy if exists "th_spec_read_public" on public.therapist_specialties;
create policy "th_spec_read_public"
  on public.therapist_specialties for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.therapists t
      where t.id = therapist_specialties.therapist_id and t.status = 'active'
    )
  );