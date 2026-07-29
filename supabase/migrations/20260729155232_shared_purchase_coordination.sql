-- Shared meetup coordination for purchase requests.
-- Both parties can edit before seller confirmation; seller confirmation writes
-- the final values and reserves the request in one transaction.

create or replace function public.update_purchase_request_coordination(
  target_request_id uuid,
  preferred_location text default '',
  preferred_time text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.purchase_requests;
  target_book public.books;
  normalized_location text := left(trim(coalesce(preferred_location, '')), 120);
  normalized_time text := left(trim(coalesce(preferred_time, '')), 120);
begin
  if not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  select * into target
  from public.purchase_requests
  where id = target_request_id
  for update;

  if target.id is null then
    raise exception 'Purchase request not found';
  end if;
  if target.status not in ('pending', 'waitlisted') then
    raise exception 'Meetup coordination is locked';
  end if;

  select * into target_book
  from public.books
  where id = target.book_id
  for update;

  if target_book.id is null
    or (target.buyer_id <> auth.uid() and target_book.seller_id <> auth.uid()) then
    raise exception 'Only the buyer or seller can edit meetup coordination';
  end if;

  if target_book.meetup_mode = 'fixed_location' then
    normalized_location := left(trim(coalesce(target_book.meetup, '')), 120);
  end if;

  if target.purchase_order_id is not null then
    if exists (
      select 1
      from public.purchase_requests
      where purchase_order_id = target.purchase_order_id
        and status in ('reserved', 'awaiting_confirmation', 'completed')
    ) then
      raise exception 'Meetup coordination is locked';
    end if;

    select * into target
    from public.purchase_requests
    where id = target_request_id
    for update;

    update public.purchase_orders
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where id = target.purchase_order_id;

    update public.purchase_requests
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where purchase_order_id = target.purchase_order_id
      and status in ('pending', 'waitlisted');
  else
    update public.purchase_requests
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where id = target_request_id;
  end if;
end;
$$;

create or replace function public.seller_confirm_purchase_request(
  target_request_id uuid,
  final_location text default '',
  final_time text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.purchase_requests;
  target_book public.books;
  normalized_location text := left(trim(coalesce(final_location, '')), 120);
  normalized_time text := left(trim(coalesce(final_time, '')), 120);
  changed_requests integer;
  changed_books integer;
begin
  if not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  select * into target
  from public.purchase_requests
  where id = target_request_id
  for update;

  if target.id is null or target.status not in ('pending', 'waitlisted') then
    raise exception 'Pending request required';
  end if;

  select * into target_book
  from public.books
  where id = target.book_id
  for update;

  if target_book.id is null
    or target_book.seller_id <> auth.uid()
    or target_book.moderation_visibility <> 'visible'
    or target_book.lifecycle_state <> 'active' then
    raise exception 'Only the active seller can confirm this request';
  end if;

  if target_book.meetup_mode = 'fixed_location' then
    normalized_location := left(trim(coalesce(target_book.meetup, '')), 120);
  end if;
  if normalized_location = '' or normalized_time = '' then
    raise exception 'Meetup location and time are required';
  end if;

  if target.purchase_order_id is not null then
    update public.purchase_orders
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where id = target.purchase_order_id;

    update public.purchase_requests
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where purchase_order_id = target.purchase_order_id
      and status in ('pending', 'waitlisted');
  else
    update public.purchase_requests
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where id = target_request_id;
  end if;

  update public.purchase_requests
  set status = 'waitlisted', updated_at = now()
  where book_id = target.book_id
    and id <> target.id
    and status = 'pending';

  update public.purchase_requests
  set status = 'reserved',
      reservation_expires_at = now() + interval '7 days',
      updated_at = now()
  where id = target.id and status = target.status;
  get diagnostics changed_requests = row_count;
  if changed_requests <> 1 then
    raise exception 'Request changed while confirming';
  end if;

  update public.books
  set status = 'negotiating', updated_at = now()
  where id = target.book_id and status = 'available';
  get diagnostics changed_books = row_count;
  if changed_books <> 1 then
    raise exception 'Listing changed while confirming';
  end if;

  insert into public.order_events (request_id, event_type, actor_id, details)
  values (
    target.id,
    'reserved',
    auth.uid(),
    jsonb_build_object(
      'expires_at', now() + interval '7 days',
      'meetup_location', normalized_location,
      'meetup_time', normalized_time
    )
  );
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
  ) values (
    target.buyer_id, auth.uid(), 'request_accepted', target.book_id, target.id,
    '你已被賣家選定',
    '《' || target.title_snapshot || '》已確認面交時間與地點，並為你保留 7 天',
    'request-reserved:' || target.id::text
  ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke all on function public.update_purchase_request_coordination(uuid, text, text) from public, anon;
grant execute on function public.update_purchase_request_coordination(uuid, text, text) to authenticated;
revoke all on function public.seller_confirm_purchase_request(uuid, text, text) from public, anon;
grant execute on function public.seller_confirm_purchase_request(uuid, text, text) to authenticated;
