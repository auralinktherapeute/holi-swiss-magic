
create or replace function public.reviews_reply_only_unchanged(
  _id uuid, _rating integer, _comment text, _status text,
  _author_name text, _user_id uuid, _therapist_id uuid, _created_at timestamptz
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reviews r
    where r.id = _id
      and r.rating is not distinct from _rating
      and r.comment is not distinct from _comment
      and r.status is not distinct from _status
      and r.author_name is not distinct from _author_name
      and r.user_id is not distinct from _user_id
      and r.therapist_id is not distinct from _therapist_id
      and r.created_at is not distinct from _created_at
  )
$$;

revoke execute on function public.reviews_reply_only_unchanged(uuid,integer,text,text,text,uuid,uuid,timestamptz) from public;
grant execute on function public.reviews_reply_only_unchanged(uuid,integer,text,text,text,uuid,uuid,timestamptz) to authenticated, service_role;

drop policy if exists "reviews_therapist_reply" on public.reviews;

create policy "reviews_therapist_reply"
on public.reviews
for update
to authenticated
using (public.is_therapist_owner(therapist_id))
with check (
  public.is_therapist_owner(therapist_id)
  and public.reviews_reply_only_unchanged(
    id, rating, comment, status, author_name, user_id, therapist_id, created_at
  )
);
