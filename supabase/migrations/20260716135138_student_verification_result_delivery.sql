-- Make student verification changes available to authorized admin Realtime
-- subscribers. The client uses events only as an invalidation signal and
-- reloads the existing moderator RPC projection.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'student_verifications'
    ) then
    execute 'alter publication supabase_realtime add table public.student_verifications';
  end if;
end;
$$;
