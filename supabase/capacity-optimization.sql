-- Capacity optimization for catalog, workspace summaries, and chat pagination.
-- Apply after listing-lifecycle.sql and multi-party-orders-and-safe-chat.sql.

create extension if not exists pg_trgm;

create index if not exists books_public_search_trgm_idx
  on public.books using gin (
    (title || ' ' || author || ' ' || course || ' ' || teacher)
    gin_trgm_ops
  )
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and lifecycle_state = 'active'
    and status <> 'sold';

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc, book_id);

create index if not exists trade_messages_conversation_sender_created_idx
  on public.trade_messages (conversation_id, sender_id, created_at desc);

create or replace function public.count_my_unread_notifications()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.notifications
  where recipient_id = auth.uid()
    and read_at is null;
$$;

create or replace function public.get_profiles_by_ids(p_ids uuid[])
returns table (id uuid, name text, department text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.department
  from public.profiles p
  where p.id = any(coalesce(p_ids, '{}'::uuid[]))
    and (
      p.id = auth.uid()
      or public.is_active_user(p.id)
      or exists (
        select 1
        from public.purchase_requests pr
        join public.books b on b.id = pr.book_id
        where (pr.buyer_id = auth.uid() and b.seller_id = p.id)
           or (b.seller_id = auth.uid() and pr.buyer_id = p.id)
      )
      or exists (
        select 1
        from public.conversations c
        where auth.uid() in (c.buyer_id, c.seller_id)
          and p.id in (c.buyer_id, c.seller_id)
      )
    );
$$;

create or replace function public.list_my_conversations_page(
  p_limit int default 30,
  p_cursor_last_message_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid, book_id uuid, buyer_id uuid, seller_id uuid, status text,
  closed_reason text, last_message_at timestamptz, unread_count bigint, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.book_id, c.buyer_id, c.seller_id, c.status, c.closed_reason,
         c.last_message_at,
         (
           select count(*)
           from public.trade_messages tm
           where tm.conversation_id = c.id
             and tm.sender_id <> auth.uid()
             and tm.created_at > case
               when auth.uid() = c.buyer_id then c.buyer_read_at
               else c.seller_read_at
             end
         )::bigint,
         c.created_at
  from public.conversations c
  where auth.uid() in (c.buyer_id, c.seller_id)
    and (
      p_cursor_last_message_at is null
      or p_cursor_id is null
      or (c.last_message_at, c.id) < (p_cursor_last_message_at, p_cursor_id)
    )
  order by c.last_message_at desc, c.id desc
  limit greatest(least(coalesce(p_limit, 30), 100), 1);
$$;

revoke execute on function public.count_my_unread_notifications() from public, anon;
revoke execute on function public.get_profiles_by_ids(uuid[]) from public;
revoke execute on function public.list_my_conversations_page(int, timestamptz, uuid) from public, anon;

grant execute on function public.count_my_unread_notifications() to authenticated;
grant execute on function public.get_profiles_by_ids(uuid[]) to anon, authenticated;
grant execute on function public.list_my_conversations_page(int, timestamptz, uuid) to authenticated;
