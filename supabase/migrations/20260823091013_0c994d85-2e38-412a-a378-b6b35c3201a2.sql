-- Helper: is the current user a member (charter accepted) of a given family?
create or replace function public.is_family_member(_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.charter_acceptances ca
    where ca.user_id = auth.uid()
      and ca.family_id = _family_id
  );
$$;

revoke execute on function public.is_family_member(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated, service_role;

-- charter_acceptances: only own rows, same-family members, or admin
drop policy if exists therapists_can_view_charter_acceptances on public.charter_acceptances;
create policy therapists_can_view_charter_acceptances
on public.charter_acceptances
for select
to authenticated
using (
  user_id = auth.uid()
  or has_role(auth.uid(), 'admin'::app_role)
  or (is_verified_therapist(auth.uid()) and public.is_family_member(family_id))
);

-- community_messages: only families the requester actually joined, or admin
drop policy if exists therapists_can_view_messages on public.community_messages;
create policy therapists_can_view_messages
on public.community_messages
for select
to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  or (is_verified_therapist(auth.uid()) and public.is_family_member(family_id))
);