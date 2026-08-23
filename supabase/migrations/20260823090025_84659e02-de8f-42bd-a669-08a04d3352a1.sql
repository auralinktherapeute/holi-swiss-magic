create or replace function public.is_verified_therapist(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.therapists t
    where t.user_id = _uid
      and t.status = 'active'
  );
$$;