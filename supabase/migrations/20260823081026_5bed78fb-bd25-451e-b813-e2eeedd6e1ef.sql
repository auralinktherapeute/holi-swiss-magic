revoke execute on function public.is_verified_therapist(uuid) from public, anon;
revoke execute on function public.community_is_muted(uuid) from public, anon;
revoke execute on function public.community_messages_lock_moderation() from public, anon, authenticated;
grant execute on function public.is_verified_therapist(uuid) to authenticated, service_role;
grant execute on function public.community_is_muted(uuid) to authenticated, service_role;