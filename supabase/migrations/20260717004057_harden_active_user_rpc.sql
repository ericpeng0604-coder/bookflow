-- Active-account checks are used inside server-side RLS and quota functions.
-- They are not a public account-status lookup API.
revoke execute on function public.is_active_user(uuid) from public, anon;
grant execute on function public.is_active_user(uuid) to authenticated;
