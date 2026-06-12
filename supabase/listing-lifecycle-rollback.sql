-- Emergency neutralization for listing-lifecycle.sql.
-- This intentionally preserves lifecycle columns, logs, notifications, and
-- transaction history so an application rollback does not destroy evidence.
-- Remove the Vercel cron deployment before or immediately after running this.

drop trigger if exists reset_confirmation_after_new_listing on public.books;

update public.books
set lifecycle_state = 'active',
    archived_at = null,
    archive_reason = '',
    updated_at = now()
where lifecycle_state <> 'active';

drop policy if exists "Approved active books are public and parties can review records"
  on public.books;
drop policy if exists "Approved visible books are public and owners can review records"
  on public.books;
create policy "Approved visible books are public and owners can review records"
  on public.books for select
  using (
    (review_status = 'approved' and moderation_visibility = 'visible')
    or seller_id = auth.uid()
    or public.is_moderator()
    or public.is_book_buyer(books.id)
  );

drop policy if exists "Active buyers can create valid requests"
  on public.purchase_requests;
create policy "Active buyers can create valid requests"
  on public.purchase_requests for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and public.is_active_user()
    and exists (
      select 1
      from public.books
      where books.id = purchase_requests.book_id
        and books.seller_id <> auth.uid()
        and books.status = 'available'
        and books.review_status = 'approved'
        and books.moderation_visibility = 'visible'
        and public.is_active_user(books.seller_id)
    )
  );

create or replace function public.get_public_profiles()
returns table (id uuid, name text, department text)
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id, profiles.name, profiles.department
  from public.profiles
  where profiles.account_status = 'active'
    and exists (
      select 1
      from public.books
      where books.seller_id = profiles.id
        and books.review_status = 'approved'
        and books.moderation_visibility = 'visible'
    )
  order by profiles.name;
$$;

revoke execute on function public.get_public_profiles() from public;
grant execute on function public.get_public_profiles() to anon, authenticated;

revoke execute on function public.process_listing_lifecycle(timestamptz)
  from public, anon, authenticated, service_role;

insert into public.listing_lifecycle_logs (action, reason, metadata)
values (
  'seller_confirmed',
  'lifecycle_emergency_neutralized',
  jsonb_build_object('neutralized_at', now())
);
