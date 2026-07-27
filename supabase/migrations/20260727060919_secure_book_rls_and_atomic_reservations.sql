-- Reconcile legacy books policies and make seller reservation atomic.
-- Run after the legacy listing, moderation, suspension, and multi-party order SQL.

-- PostgreSQL combines permissive policies with OR. Remove every historical
-- books policy before installing the single current authorization model.
drop policy if exists "Books are publicly readable" on public.books;
drop policy if exists "Users can create their own listings" on public.books;
drop policy if exists "Sellers can update their own listings" on public.books;
drop policy if exists "Sellers can delete their own listings" on public.books;
drop policy if exists "Approved books are public and parties can review their records" on public.books;
drop policy if exists "Users can create pending listings" on public.books;
drop policy if exists "Sellers and moderators can delete listings" on public.books;
drop policy if exists "Approved visible books are public and owners can review records" on public.books;
drop policy if exists "Active users can create pending listings" on public.books;
drop policy if exists "Active sellers can update their listings" on public.books;
drop policy if exists "Active sellers and moderators can delete listings" on public.books;
drop policy if exists "Approved active books are public and parties can review records" on public.books;

create policy "Approved active books are public and parties can review records"
  on public.books for select to anon, authenticated
  using (
    (
      review_status = 'approved'
      and moderation_visibility = 'visible'
      and lifecycle_state = 'active'
      and status <> 'sold'
    )
    or seller_id = auth.uid()
    or public.is_moderator()
    or public.is_book_buyer(id)
  );

create policy "Active users can create pending listings"
  on public.books for insert to authenticated
  with check (
    auth.uid() = seller_id
    and public.is_active_user()
    and review_status = 'pending'
    and moderation_visibility = 'visible'
    and lifecycle_state = 'active'
  );

create policy "Active sellers can update their listings"
  on public.books for update to authenticated
  using (
    (auth.uid() = seller_id and public.is_active_user())
    or public.is_moderator()
  )
  with check (
    public.is_moderator()
    or (
      auth.uid() = seller_id
      and public.is_active_user()
      and moderation_visibility = 'visible'
      and lifecycle_state = 'active'
    )
  );

create policy "Active sellers and moderators can delete listings"
  on public.books for delete to authenticated
  using (
    (auth.uid() = seller_id and public.is_active_user())
    or public.is_moderator()
  );

revoke insert, update, delete on table public.books from anon;
grant select on table public.books to anon, authenticated;
grant insert, delete on table public.books to authenticated;

-- Keep the existing seller update allowlist. Moderation and lifecycle fields
-- remain writable only through their authorization-aware functions.
revoke update on table public.books from authenticated;
grant update (
  listing_type,
  item_category,
  title,
  author,
  department,
  course,
  teacher,
  edition,
  publisher,
  education_level,
  grade,
  semester,
  subject,
  volume,
  curriculum,
  book_type,
  isbn13,
  approval_number,
  condition,
  price,
  image_url,
  meetup,
  description,
  updated_at
) on table public.books to authenticated;

-- The current order flow uses text statuses after the multi-party migration.
-- Locking the request and then its book serializes competing sellers' choices.
create or replace function public.respond_to_purchase_request(
  request_id uuid,
  response text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.purchase_requests;
  target_book public.books;
  changed_requests integer;
  changed_books integer;
begin
  if not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if response not in ('accepted', 'rejected') then
    raise exception 'Invalid response';
  end if;

  select * into target
  from public.purchase_requests
  where id = request_id
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
    raise exception 'Only the active seller can respond';
  end if;

  if response = 'rejected' then
    update public.purchase_requests
    set status = 'rejected', updated_at = now()
    where id = target.id and status = target.status;
    get diagnostics changed_requests = row_count;
    if changed_requests <> 1 then
      raise exception 'Request changed while responding';
    end if;
    insert into public.order_events (request_id, event_type, actor_id)
    values (target.id, 'rejected', auth.uid());
    insert into public.notifications (
      recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
    ) values (
      target.buyer_id, auth.uid(), 'request_rejected', target.book_id, target.id,
      '購買請求未被選定',
      '賣家未選擇你購買《' || target.title_snapshot || '》',
      'request-rejected:' || target.id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
    return;
  end if;

  if target_book.status <> 'available' then
    raise exception 'Another buyer is already reserved';
  end if;

  update public.purchase_requests
  set status = 'waitlisted', updated_at = now()
  where book_id = target.book_id and id <> target.id and status = 'pending';

  update public.purchase_requests
  set status = 'reserved',
      reservation_expires_at = now() + interval '7 days',
      updated_at = now()
  where id = target.id and status = target.status;
  get diagnostics changed_requests = row_count;
  if changed_requests <> 1 then
    raise exception 'Request changed while reserving';
  end if;

  update public.books
  set status = 'negotiating', updated_at = now()
  where id = target.book_id and status = 'available';
  get diagnostics changed_books = row_count;
  if changed_books <> 1 then
    raise exception 'Listing changed while reserving';
  end if;

  insert into public.order_events (request_id, event_type, actor_id, details)
  values (
    target.id,
    'reserved',
    auth.uid(),
    jsonb_build_object('expires_at', now() + interval '7 days')
  );
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
  ) values (
    target.buyer_id, auth.uid(), 'request_accepted', target.book_id, target.id,
    '你已被賣家選定',
    '《' || target.title_snapshot || '》為你保留 7 天，請和賣家完成面交',
    'request-reserved:' || target.id::text
  ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

-- Preserve the legacy enum RPC signature for older clients while routing it
-- through the same locked implementation.
create or replace function public.respond_to_purchase_request(
  request_id uuid,
  response public.request_status
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.respond_to_purchase_request(request_id, response::text);
end;
$$;

revoke execute on function public.respond_to_purchase_request(uuid, text)
  from public, anon;
grant execute on function public.respond_to_purchase_request(uuid, text)
  to authenticated;
revoke execute on function public.respond_to_purchase_request(uuid, public.request_status)
  from public, anon;
grant execute on function public.respond_to_purchase_request(uuid, public.request_status)
  to authenticated;

-- The production bundle RPC previously locked only the parent bundle row.
-- Lock every selected book in deterministic order before changing any status.
create or replace function public.respond_to_bundle_purchase_request(
  target_bundle_id uuid,
  response text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bundle public.bundle_purchase_requests;
  book_row record;
  active_item_count integer;
  locked_book_count integer := 0;
  unavailable_count integer := 0;
  updated_book_count integer;
  changed_bundles integer;
  notification_type text;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if response not in ('accepted', 'rejected') then
    raise exception 'Invalid response';
  end if;

  select * into bundle
  from public.bundle_purchase_requests
  where id = target_bundle_id
  for update;

  if bundle.id is null
    or bundle.seller_id <> auth.uid()
    or bundle.status <> 'pending' then
    raise exception 'Pending bundle request required';
  end if;

  if response = 'accepted' then
    select count(*) into active_item_count
    from public.bundle_purchase_request_items
    where bundle_id = bundle.id
      and item_status = 'active';
    if active_item_count = 0 then
      raise exception 'At least one active listing is required';
    end if;

    -- The ordered FOR UPDATE is the serialization point shared by all
    -- bundles that contain any of these listings.
    for book_row in
      select book.id, book.seller_id, book.status, book.review_status,
             book.moderation_visibility, book.lifecycle_state
      from public.books book
      join public.bundle_purchase_request_items item
        on item.book_id = book.id
      where item.bundle_id = bundle.id
        and item.item_status = 'active'
      order by book.id
      for update
    loop
      locked_book_count := locked_book_count + 1;
      if book_row.seller_id <> bundle.seller_id
        or book_row.status <> 'available'
        or book_row.review_status <> 'approved'
        or book_row.moderation_visibility <> 'visible'
        or book_row.lifecycle_state <> 'active' then
        unavailable_count := unavailable_count + 1;
      end if;
    end loop;

    if locked_book_count <> active_item_count then
      raise exception 'A selected listing no longer exists';
    end if;
    if unavailable_count > 0 then
      raise exception 'A selected listing is unavailable';
    end if;

    update public.books book
    set status = 'negotiating',
        updated_at = now()
    where book.id in (
      select item.book_id
      from public.bundle_purchase_request_items item
      where item.bundle_id = bundle.id
        and item.item_status = 'active'
    )
      and book.status = 'available';
    get diagnostics updated_book_count = row_count;
    if updated_book_count <> active_item_count then
      raise exception 'Listing reservation changed while accepting bundle';
    end if;

    update public.bundle_purchase_requests
    set status = 'reserved',
        accepted_at = now(),
        expires_at = now() + interval '7 days',
        updated_at = now()
    where id = bundle.id and status = 'pending';
    get diagnostics changed_bundles = row_count;
    if changed_bundles <> 1 then
      raise exception 'Bundle changed while accepting';
    end if;
    notification_type := 'bundle_request_accepted';
  else
    update public.bundle_purchase_requests
    set status = 'rejected',
        updated_at = now()
    where id = bundle.id and status = 'pending';
    get diagnostics changed_bundles = row_count;
    if changed_bundles <> 1 then
      raise exception 'Bundle changed while rejecting';
    end if;
    notification_type := 'bundle_request_rejected';
  end if;

  insert into public.notifications (
    recipient_id, actor_id, type, bundle_id, title, message
  ) values (
    bundle.buyer_id,
    bundle.seller_id,
    notification_type,
    bundle.id,
    case when response = 'accepted'
      then '合併購買意願已接受'
      else '合併購買意願已拒絕'
    end,
    case when response = 'accepted'
      then '賣家已接受整筆合併單，商品已保留。'
      else '賣家已拒絕整筆合併單。'
    end
  );
end;
$$;

revoke execute on function public.respond_to_bundle_purchase_request(uuid, text)
  from public, anon;
grant execute on function public.respond_to_bundle_purchase_request(uuid, text)
  to authenticated;
