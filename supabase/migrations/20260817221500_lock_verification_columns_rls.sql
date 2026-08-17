-- Defense in depth: forbid non-admins from changing verification/status columns
-- directly at the RLS layer (in addition to the existing BEFORE UPDATE triggers).

create or replace function public.therapists_admin_fields_unchanged(
  _id uuid, _status text, _verified boolean, _ide_verified boolean,
  _siret_verified boolean, _subscription_plan text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin'::app_role)
      or exists (
        select 1 from public.therapists t
        where t.id = _id
          and t.status is not distinct from _status
          and t.verified is not distinct from _verified
          and t.ide_verified is not distinct from _ide_verified
          and t.siret_verified is not distinct from _siret_verified
          and t.subscription_plan is not distinct from _subscription_plan
      );
$$;

revoke execute on function public.therapists_admin_fields_unchanged(uuid, text, boolean, boolean, boolean, text) from public;
grant execute on function public.therapists_admin_fields_unchanged(uuid, text, boolean, boolean, boolean, text) to anon, authenticated, service_role;

drop policy if exists "therapist cannot self-verify" on public.therapists;
create policy "therapist cannot self-verify"
  on public.therapists
  as restrictive
  for update
  to authenticated
  using (true)
  with check (
    public.therapists_admin_fields_unchanged(id, status, verified, ide_verified, siret_verified, subscription_plan)
  );

create or replace function public.certification_verification_unchanged(
  _id uuid, _verification_status text, _verified_at timestamptz, _verified_by uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid())
      or exists (
        select 1 from public.therapist_certifications c
        where c.id = _id
          and c.verification_status is not distinct from _verification_status
          and c.verified_at is not distinct from _verified_at
          and c.verified_by is not distinct from _verified_by
      )
      -- INSERT by owner: only the neutral declared state is allowed
      or (not exists (select 1 from public.therapist_certifications c where c.id = _id)
          and coalesce(_verification_status, 'declared') = 'declared'
          and _verified_at is null
          and _verified_by is null);
$$;

revoke execute on function public.certification_verification_unchanged(uuid, text, timestamptz, uuid) from public;
grant execute on function public.certification_verification_unchanged(uuid, text, timestamptz, uuid) to anon, authenticated, service_role;

drop policy if exists "certif verification admin only" on public.therapist_certifications;
create policy "certif verification admin only"
  on public.therapist_certifications
  as restrictive
  for all
  to authenticated
  using (true)
  with check (
    public.certification_verification_unchanged(id, verification_status, verified_at, verified_by)
  );
