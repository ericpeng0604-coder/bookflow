-- Add safe conversation-list summaries without changing the chat data model.

-- A table-returning function's result columns are part of its return type, so
-- these two functions must be recreated when the summary columns are added.
drop function if exists public.list_my_conversations();
drop function if exists public.list_my_conversations_page(integer, timestamptz, uuid);

create function public.list_my_conversations()
returns table (
  id uuid, book_id uuid, buyer_id uuid, seller_id uuid, status text,
  closed_reason text, last_message_at timestamptz, last_message_sender_id uuid,
  last_message_preview text, unread_count bigint, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.book_id, c.buyer_id, c.seller_id, c.status, c.closed_reason,
         c.last_message_at,
         latest.sender_id,
         coalesce(latest.preview, ''),
         (
           select count(*) from public.trade_messages tm
           where tm.conversation_id = c.id
             and tm.sender_id <> auth.uid()
             and tm.created_at > case when auth.uid() = c.buyer_id then c.buyer_read_at else c.seller_read_at end
         )::bigint,
         c.created_at
  from public.conversations c
  left join lateral (
    select tm.sender_id,
           case
             when tm.recalled_at is not null then '訊息已收回'
             when nullif(trim(tm.body), '') is not null then left(trim(tm.body), 160)
             when cardinality(tm.image_paths) > 0 then '圖片訊息'
             else ''
           end as preview
    from public.trade_messages tm
    where tm.conversation_id = c.id
    order by tm.created_at desc, tm.id desc
    limit 1
  ) latest on true
  where auth.uid() in (c.buyer_id, c.seller_id)
    and not exists (
      select 1
      from public.conversation_user_preferences preference
      where preference.conversation_id = c.id
        and preference.user_id = auth.uid()
        and preference.hidden_at is not null
    )
  order by c.last_message_at desc;
$$;

create function public.list_my_conversations_page(
  p_limit int default 30,
  p_cursor_last_message_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid, book_id uuid, buyer_id uuid, seller_id uuid, status text,
  closed_reason text, last_message_at timestamptz, last_message_sender_id uuid,
  last_message_preview text, unread_count bigint, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.book_id, c.buyer_id, c.seller_id, c.status, c.closed_reason,
         c.last_message_at,
         latest.sender_id,
         coalesce(latest.preview, ''),
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
  left join lateral (
    select tm.sender_id,
           case
             when tm.recalled_at is not null then '訊息已收回'
             when nullif(trim(tm.body), '') is not null then left(trim(tm.body), 160)
             when cardinality(tm.image_paths) > 0 then '圖片訊息'
             else ''
           end as preview
    from public.trade_messages tm
    where tm.conversation_id = c.id
    order by tm.created_at desc, tm.id desc
    limit 1
  ) latest on true
  where auth.uid() in (c.buyer_id, c.seller_id)
    and not exists (
      select 1
      from public.conversation_user_preferences preference
      where preference.conversation_id = c.id
        and preference.user_id = auth.uid()
        and preference.hidden_at is not null
    )
    and (
      p_cursor_last_message_at is null
      or p_cursor_id is null
      or (c.last_message_at, c.id) < (p_cursor_last_message_at, p_cursor_id)
    )
  order by c.last_message_at desc, c.id desc
  limit greatest(least(coalesce(p_limit, 30), 100), 1);
$$;
