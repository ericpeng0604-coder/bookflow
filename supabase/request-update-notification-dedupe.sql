-- Run after listing-lifecycle.sql and multi-party-orders-and-safe-chat.sql.
-- Keeps repeated edits to the same purchase request in one in-app notification.

with ranked_updates as (
  select
    id,
    request_id,
    row_number() over (
      partition by request_id
      order by created_at desc, id desc
    ) as position
  from public.notifications
  where request_id is not null
    and type = 'request_created'
    and title = '買家修改了訂單'
),
removed_duplicates as (
  delete from public.notifications
  where id in (
    select id
    from ranked_updates
    where position > 1
  )
)
update public.notifications notification
set dedupe_key = 'request-updated:' || notification.request_id::text
where notification.id in (
  select id
  from ranked_updates
  where position = 1
)
  and notification.dedupe_key is null;

create or replace function public.create_purchase_request(target_book_id uuid, request_message text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare target_book public.books; existing_request public.purchase_requests; created_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Active account required'; end if;
  select * into target_book from public.books where id = target_book_id for update;
  if target_book.id is null or target_book.seller_id = auth.uid()
    or target_book.lifecycle_state <> 'active'
    or target_book.review_status <> 'approved' or target_book.moderation_visibility <> 'visible' then
    raise exception 'Book is not accepting orders';
  end if;
  select * into existing_request
  from public.purchase_requests
  where book_id = target_book_id
    and buyer_id = auth.uid()
    and status in ('pending', 'waitlisted', 'reserved', 'awaiting_confirmation')
  for update;
  if existing_request.id is not null then
    update public.purchase_requests
    set message = left(coalesce(request_message, ''), 500),
        updated_at = now()
    where id = existing_request.id;
    insert into public.order_events (request_id, event_type, actor_id)
    values (existing_request.id, 'request_updated', auth.uid());
    insert into public.notifications (
      recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
    ) values (
      target_book.seller_id, auth.uid(), 'request_created', target_book.id, existing_request.id,
      '買家修改了訂單', '「' || target_book.title || '」的購買意願內容已更新',
      'request-updated:' || existing_request.id::text
    )
    on conflict (dedupe_key) where dedupe_key is not null
    do update set
      actor_id = excluded.actor_id,
      title = excluded.title,
      message = excluded.message,
      read_at = null,
      created_at = now();
    return existing_request.id;
  end if;
  if target_book.status <> 'available' then
    raise exception 'Book is not accepting orders';
  end if;
  insert into public.purchase_requests (
    book_id, buyer_id, message, status, title_snapshot, price_snapshot,
    edition_snapshot, image_snapshot, meetup_snapshot
  ) values (
    target_book.id, auth.uid(), left(coalesce(request_message, ''), 500), 'pending',
    target_book.title, target_book.price, target_book.edition, target_book.image_url, target_book.meetup
  ) returning id into created_id;
  insert into public.order_events (request_id, event_type, actor_id)
  values (created_id, 'requested', auth.uid());
  perform public.open_order_conversation(created_id);
  return created_id;
end;
$$;

revoke execute on function public.create_purchase_request(uuid, text) from public, anon;
grant execute on function public.create_purchase_request(uuid, text) to authenticated;
