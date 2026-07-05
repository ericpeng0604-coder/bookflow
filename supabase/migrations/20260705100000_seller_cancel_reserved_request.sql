create or replace function public.cancel_purchase_request(target_request_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.purchase_requests;
  target_book public.books;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if char_length(btrim(coalesce(reason, ''))) < 2 then
    raise exception 'Cancellation reason required';
  end if;

  select *
    into target
  from public.purchase_requests
  where id = target_request_id
  for update;

  if target.id is null then
    raise exception 'Cancellable order required';
  end if;

  select *
    into target_book
  from public.books
  where id = target.book_id
  for update;

  if target_book.id is null then
    raise exception 'Listing required';
  end if;

  if not (
    actor = target.buyer_id
    and target.status in ('pending', 'waitlisted', 'reserved', 'awaiting_confirmation')
  ) and not (
    actor = target_book.seller_id
    and target.status in ('reserved', 'awaiting_confirmation')
  ) then
    raise exception 'Cancellable order required';
  end if;

  update public.purchase_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = left(btrim(reason), 500),
      updated_at = now()
  where id = target.id;

  if target.status in ('reserved', 'awaiting_confirmation') then
    update public.books
    set status = 'available',
        updated_at = now()
    where id = target.book_id;

    update public.purchase_requests
    set status = 'pending',
        updated_at = now()
    where book_id = target.book_id
      and status = 'waitlisted';
  end if;

  insert into public.order_events (request_id, event_type, actor_id, details)
  values (target.id, 'cancelled', actor, jsonb_build_object('reason', left(btrim(reason), 500)));

  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
  ) values (
    case when actor = target.buyer_id then target_book.seller_id else target.buyer_id end,
    actor, 'reservation_cancelled', target.book_id, target.id,
    '訂單已取消', '《' || target.title_snapshot || '》的訂單已取消：' || left(btrim(reason), 200),
    'order-cancelled:' || target.id::text || ':' || extract(epoch from now())::bigint::text
  );
end;
$$;

revoke execute on function public.cancel_purchase_request(uuid, text) from public, anon;
grant execute on function public.cancel_purchase_request(uuid, text) to authenticated;
