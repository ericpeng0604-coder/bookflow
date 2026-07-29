-- Seller storefronts and multi-listing purchase-intent bundles.
-- Kept separate from purchase_requests because legacy requests are one listing per request.

create table if not exists public.bundle_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'reserved', 'rejected', 'cancelled', 'expired', 'completed')),
  message text not null default '' check (char_length(message) <= 500),
  preferred_meetup_location text not null default '' check (char_length(preferred_meetup_location) <= 120),
  preferred_meetup_time text not null default '' check (char_length(preferred_meetup_time) <= 120),
  total_price_snapshot integer not null default 0 check (total_price_snapshot >= 0),
  expires_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text not null default '',
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create table if not exists public.bundle_purchase_request_items (
  bundle_id uuid not null references public.bundle_purchase_requests(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  position integer not null default 0,
  item_status text not null default 'active'
    check (item_status in ('active', 'unavailable', 'removed')),
  title_snapshot text not null default '',
  price_snapshot integer not null default 0 check (price_snapshot >= 0),
  edition_snapshot text not null default '',
  image_snapshot text not null default '',
  meetup_snapshot text not null default '',
  unavailable_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (bundle_id, book_id)
);

create unique index if not exists bundle_requests_one_active_per_seller
  on public.bundle_purchase_requests (buyer_id, seller_id)
  where status in ('draft', 'pending', 'reserved');
create index if not exists bundle_request_items_book_idx
  on public.bundle_purchase_request_items (book_id, item_status);
create index if not exists bundle_requests_seller_status_idx
  on public.bundle_purchase_requests (seller_id, status, created_at desc);
create index if not exists bundle_requests_buyer_status_idx
  on public.bundle_purchase_requests (buyer_id, status, created_at desc);

alter table public.bundle_purchase_requests enable row level security;
alter table public.bundle_purchase_request_items enable row level security;
revoke all on public.bundle_purchase_requests, public.bundle_purchase_request_items from public, anon;
grant select on public.bundle_purchase_requests, public.bundle_purchase_request_items to authenticated;

drop policy if exists "Bundle parties read bundle requests" on public.bundle_purchase_requests;
create policy "Bundle parties read bundle requests"
  on public.bundle_purchase_requests for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));

drop policy if exists "Bundle parties read bundle items" on public.bundle_purchase_request_items;
create policy "Bundle parties read bundle items"
  on public.bundle_purchase_request_items for select to authenticated
  using (
    exists (
      select 1
      from public.bundle_purchase_requests bundle
      where bundle.id = bundle_purchase_request_items.bundle_id
        and auth.uid() in (bundle.buyer_id, bundle.seller_id)
    )
  );

alter table public.conversations
  add column if not exists bundle_id uuid references public.bundle_purchase_requests(id) on delete set null;
create unique index if not exists conversations_one_active_bundle
  on public.conversations (bundle_id)
  where bundle_id is not null and status = 'active';

alter table public.notifications
  add column if not exists bundle_id uuid references public.bundle_purchase_requests(id) on delete cascade;
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'request_created', 'request_accepted', 'request_rejected', 'trade_completed',
      'book_approved', 'book_rejected', 'book_hidden', 'account_suspended',
      'trade_message', 'listing_lifecycle', 'order_reminder', 'order_expired',
      'reservation_cancelled', 'handoff_confirmation', 'book_sold',
      'bundle_request_created', 'bundle_request_accepted', 'bundle_request_rejected',
      'bundle_request_cancelled', 'bundle_request_expired', 'bundle_trade_completed'
    )
  );

create or replace function public.get_public_seller_profile(target_seller_id uuid)
returns table (id uuid, name text, department text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.department
  from public.profiles p
  where p.id = target_seller_id
    and public.is_active_user(p.id)
    and exists (
      select 1 from public.books b
      where b.seller_id = p.id
        and b.review_status = 'approved'
        and b.moderation_visibility = 'visible'
        and b.lifecycle_state = 'active'
        and b.status <> 'sold'
    );
$$;

create or replace function public.list_seller_public_books(target_seller_id uuid)
returns table (
  id uuid,
  seller_id uuid,
  listing_type text,
  item_category text,
  title text,
  author text,
  department text,
  course text,
  teacher text,
  edition text,
  publisher text,
  education_level text,
  grade text,
  semester text,
  subject text,
  volume text,
  curriculum text,
  book_type text,
  isbn13 text,
  approval_number text,
  condition text,
  price integer,
  image_url text,
  meetup text,
  description text,
  status public.book_status,
  review_status text,
  review_note text,
  moderation_visibility text,
  lifecycle_state text,
  listing_confirmed_at timestamptz,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    b.id,
    b.seller_id,
    b.listing_type,
    b.item_category,
    b.title,
    b.author,
    b.department,
    b.course,
    b.teacher,
    b.edition,
    b.publisher,
    b.education_level,
    b.grade,
    b.semester,
    b.subject,
    b.volume,
    b.curriculum,
    b.book_type,
    b.isbn13,
    b.approval_number,
    b.condition,
    b.price,
    b.image_url,
    b.meetup,
    b.description,
    b.status,
    b.review_status,
    b.review_note,
    b.moderation_visibility,
    b.lifecycle_state,
    b.listing_confirmed_at,
    b.archived_at,
    b.archive_reason,
    b.created_at,
    b.updated_at
  from public.books b
  where b.seller_id = target_seller_id
    and b.review_status = 'approved'
    and b.moderation_visibility = 'visible'
    and b.lifecycle_state = 'active'
    and b.status <> 'sold'
  order by b.created_at desc, b.id desc;
$$;
create or replace function public.save_bundle_draft(
  target_seller_id uuid,
  target_book_ids uuid[] default '{}'::uuid[]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  bundle_id uuid;
  selected_count integer;
  valid_count integer;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if target_seller_id = auth.uid() then
    raise exception 'Cannot buy your own listings';
  end if;
  if coalesce(array_length(target_book_ids, 1), 0) > 50 then
    raise exception 'Too many listings selected';
  end if;

  selected_count := coalesce(array_length(target_book_ids, 1), 0);
  select count(*) into valid_count
  from public.books b
  where b.id = any(coalesce(target_book_ids, '{}'::uuid[]))
    and b.seller_id = target_seller_id;
  if valid_count <> selected_count then
    raise exception 'All selected listings must belong to the same seller';
  end if;

  select id into bundle_id
  from public.bundle_purchase_requests
  where buyer_id = auth.uid()
    and seller_id = target_seller_id
    and status = 'draft'
  order by updated_at desc
  limit 1
  for update;

  if bundle_id is null then
    insert into public.bundle_purchase_requests (buyer_id, seller_id, status)
    values (auth.uid(), target_seller_id, 'draft')
    returning id into bundle_id;
  end if;

  delete from public.bundle_purchase_request_items
  where bundle_id = save_bundle_draft.bundle_id;

  insert into public.bundle_purchase_request_items (
    bundle_id, book_id, position, title_snapshot, price_snapshot,
    edition_snapshot, image_snapshot, meetup_snapshot
  )
  select
    bundle_id,
    b.id,
    row_number() over (order by array_position(target_book_ids, b.id)) - 1,
    b.title,
    b.price,
    b.edition,
    b.image_url,
    b.meetup
  from public.books b
  where b.id = any(coalesce(target_book_ids, '{}'::uuid[]))
    and b.seller_id = target_seller_id;

  update public.bundle_purchase_requests
  set total_price_snapshot = coalesce((
        select sum(price_snapshot)
        from public.bundle_purchase_request_items
        where bundle_id = save_bundle_draft.bundle_id
      ), 0),
      updated_at = now()
  where id = bundle_id;

  return bundle_id;
end;
$$;

create or replace function public.submit_bundle_purchase_request(
  target_bundle_id uuid,
  request_message text default '',
  preferred_meetup_location text default '',
  preferred_meetup_time text default ''
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  bundle public.bundle_purchase_requests;
  item record;
  primary_book_id uuid;
  conversation_id uuid;
  unavailable_count integer;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  select * into bundle
  from public.bundle_purchase_requests
  where id = target_bundle_id
    and buyer_id = auth.uid()
    and status = 'draft'
  for update;

  if bundle.id is null then
    raise exception 'Draft bundle required';
  end if;

  update public.bundle_purchase_request_items as item
  set item_status = 'unavailable',
      unavailable_at = coalesce(item.unavailable_at, now())
  from public.books book
  where item.bundle_id = bundle.id
    and item.item_status = 'active'
    and book.id = item.book_id
    and not (
      book.seller_id = bundle.seller_id
      and book.status = 'available'
      and book.review_status = 'approved'
      and book.moderation_visibility = 'visible'
      and book.lifecycle_state = 'active'
      and public.is_active_user(book.seller_id)
    );

  select count(*) into unavailable_count
  from public.bundle_purchase_request_items
  where bundle_id = bundle.id
    and item_status <> 'active';
  if unavailable_count > 0 then
    raise exception 'Remove unavailable listings before submitting';
  end if;

  select book_id into primary_book_id
  from public.bundle_purchase_request_items
  where bundle_id = bundle.id
    and item_status = 'active'
  order by position
  limit 1;
  if primary_book_id is null then
    raise exception 'At least one listing required';
  end if;

  for item in
    select i.book_id
    from public.bundle_purchase_request_items i
    where i.bundle_id = bundle.id
      and i.item_status = 'active'
    for update
  loop
    if exists (
      select 1
      from public.purchase_requests pr
      where pr.book_id = item.book_id
        and pr.buyer_id = auth.uid()
        and pr.status in ('pending', 'waitlisted', 'reserved', 'awaiting_confirmation')
    ) then
      raise exception 'A listing already has an active purchase request';
    end if;
  end loop;

  update public.bundle_purchase_requests
  set status = 'pending',
      message = left(coalesce(request_message, ''), 500),
      preferred_meetup_location = left(coalesce(preferred_meetup_location, ''), 120),
      preferred_meetup_time = left(coalesce(preferred_meetup_time, ''), 120),
      total_price_snapshot = coalesce((
        select sum(price_snapshot)
        from public.bundle_purchase_request_items
        where bundle_id = bundle.id
          and item_status = 'active'
      ), 0),
      expires_at = now() + interval '7 days',
      updated_at = now()
  where id = bundle.id;

  select id into conversation_id
  from public.conversations
  where bundle_id = bundle.id
    and status = 'active';

  if conversation_id is null then
    insert into public.conversations (book_id, bundle_id, buyer_id, seller_id)
    values (primary_book_id, bundle.id, bundle.buyer_id, bundle.seller_id)
    returning id into conversation_id;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, type, book_id, conversation_id, bundle_id, title, message
  ) values (
    bundle.seller_id,
    bundle.buyer_id,
    'bundle_request_created',
    primary_book_id,
    conversation_id,
    bundle.id,
    '新的合併購買意願',
    '買家想一次購買你的多件商品，請查看合併單。'
  );

  return bundle.id;
end;
$$;

create or replace function public.respond_to_bundle_purchase_request(
  target_bundle_id uuid,
  response text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  bundle public.bundle_purchase_requests;
  unavailable_count integer;
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
    update public.bundle_purchase_request_items as item
    set item_status = 'unavailable',
        unavailable_at = coalesce(item.unavailable_at, now())
    from public.books book
    where item.bundle_id = bundle.id
      and item.item_status = 'active'
      and book.id = item.book_id
      and (
        book.status <> 'available'
        or book.review_status <> 'approved'
        or book.moderation_visibility <> 'visible'
        or book.lifecycle_state <> 'active'
      );

    select count(*) into unavailable_count
    from public.bundle_purchase_request_items
    where bundle_id = bundle.id
      and item_status <> 'active';
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

    update public.bundle_purchase_requests
    set status = 'reserved',
        accepted_at = now(),
        expires_at = now() + interval '7 days',
        updated_at = now()
    where id = bundle.id;
    notification_type := 'bundle_request_accepted';
  else
    update public.bundle_purchase_requests
    set status = 'rejected',
        updated_at = now()
    where id = bundle.id;
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

create or replace function public.cancel_bundle_purchase_request(
  target_bundle_id uuid,
  reason text default 'cancelled'
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  bundle public.bundle_purchase_requests;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  select * into bundle
  from public.bundle_purchase_requests
  where id = target_bundle_id
  for update;

  if bundle.id is null
    or auth.uid() not in (bundle.buyer_id, bundle.seller_id)
    or bundle.status not in ('pending', 'reserved') then
    raise exception 'Cancellable bundle required';
  end if;

  if bundle.status = 'reserved' then
    update public.books book
    set status = 'available',
        updated_at = now()
    where book.id in (
      select item.book_id
      from public.bundle_purchase_request_items item
      where item.bundle_id = bundle.id
        and item.item_status = 'active'
    )
      and book.status = 'negotiating'
      and not exists (
        select 1
        from public.purchase_requests pr
        where pr.book_id = book.id
          and pr.status in ('reserved', 'awaiting_confirmation')
      );
  end if;

  update public.bundle_purchase_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = left(coalesce(reason, 'cancelled'), 500),
      updated_at = now()
  where id = bundle.id;

  insert into public.notifications (
    recipient_id, actor_id, type, bundle_id, title, message
  ) values (
    case when auth.uid() = bundle.buyer_id then bundle.seller_id else bundle.buyer_id end,
    auth.uid(),
    'bundle_request_cancelled',
    bundle.id,
    '合併購買意願已取消',
    '整筆合併單已取消，商品已釋放。'
  );
end;
$$;

create or replace function public.confirm_bundle_purchase_request(target_bundle_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  bundle public.bundle_purchase_requests;
  completed boolean;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  select * into bundle
  from public.bundle_purchase_requests
  where id = target_bundle_id
  for update;

  if bundle.id is null
    or auth.uid() not in (bundle.buyer_id, bundle.seller_id)
    or bundle.status <> 'reserved' then
    raise exception 'Reserved bundle required';
  end if;

  update public.bundle_purchase_requests
  set buyer_confirmed_at = case
        when auth.uid() = buyer_id then coalesce(buyer_confirmed_at, now())
        else buyer_confirmed_at
      end,
      seller_confirmed_at = case
        when auth.uid() = seller_id then coalesce(seller_confirmed_at, now())
        else seller_confirmed_at
      end,
      updated_at = now()
  where id = bundle.id;

  select buyer_confirmed_at is not null and seller_confirmed_at is not null
    into completed
  from public.bundle_purchase_requests
  where id = bundle.id;

  if completed then
    update public.bundle_purchase_requests
    set status = 'completed',
        updated_at = now()
    where id = bundle.id;

    update public.books
    set status = 'sold',
        updated_at = now()
    where id in (
      select book_id
      from public.bundle_purchase_request_items
      where bundle_id = bundle.id
        and item_status = 'active'
    );

    insert into public.notifications (
      recipient_id, actor_id, type, bundle_id, title, message
    ) values (
      case when auth.uid() = bundle.buyer_id then bundle.seller_id else bundle.buyer_id end,
      auth.uid(),
      'bundle_trade_completed',
      bundle.id,
      '合併交易已完成',
      '雙方已確認整筆合併交易完成。'
    );
  end if;
end;
$$;

create or replace function public.process_bundle_deadlines(reference_time timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  bundle record;
  expired_count integer := 0;
  released_count integer := 0;
  released_rows integer := 0;
begin
  for bundle in
    select id, buyer_id, seller_id, status
    from public.bundle_purchase_requests
    where status in ('pending', 'reserved')
      and expires_at is not null
      and expires_at <= reference_time
    for update
  loop
    if bundle.status = 'reserved' then
      update public.books book
      set status = 'available', updated_at = reference_time
      where book.id in (
        select item.book_id
        from public.bundle_purchase_request_items item
        where item.bundle_id = bundle.id
          and item.item_status = 'active'
      )
        and book.status = 'negotiating'
        and not exists (
          select 1
          from public.purchase_requests pr
          where pr.book_id = book.id
            and pr.status in ('reserved', 'awaiting_confirmation')
        );
      get diagnostics released_rows = row_count;
      released_count := released_count + released_rows;
    end if;

    update public.bundle_purchase_requests
    set status = 'expired',
        cancellation_reason = 'expired',
        updated_at = reference_time
    where id = bundle.id;

    insert into public.notifications (recipient_id, type, bundle_id, title, message)
    values
      (bundle.buyer_id, 'bundle_request_expired', bundle.id, '合併購買意願已逾期', '這筆合併單超過 7 天未完成，已自動結束。'),
      (bundle.seller_id, 'bundle_request_expired', bundle.id, '合併購買意願已逾期', '這筆合併單超過 7 天未完成，已自動結束。');
    expired_count := expired_count + 1;
  end loop;

  return jsonb_build_object('expired', expired_count, 'released', released_count);
end;
$$;
revoke execute on function public.process_bundle_deadlines(timestamptz) from public, anon, authenticated;
grant execute on function public.process_bundle_deadlines(timestamptz) to service_role;
revoke execute on function public.get_public_seller_profile(uuid) from public;
revoke execute on function public.list_seller_public_books(uuid) from public;
grant execute on function public.get_public_seller_profile(uuid) to anon, authenticated;
grant execute on function public.list_seller_public_books(uuid) to anon, authenticated;
revoke execute on function public.save_bundle_draft(uuid, uuid[]) from public, anon;
revoke execute on function public.submit_bundle_purchase_request(uuid, text, text, text) from public, anon;
revoke execute on function public.respond_to_bundle_purchase_request(uuid, text) from public, anon;
revoke execute on function public.cancel_bundle_purchase_request(uuid, text) from public, anon;
revoke execute on function public.confirm_bundle_purchase_request(uuid) from public, anon;
grant execute on function public.save_bundle_draft(uuid, uuid[]) to authenticated;
grant execute on function public.submit_bundle_purchase_request(uuid, text, text, text) to authenticated;
grant execute on function public.respond_to_bundle_purchase_request(uuid, text) to authenticated;
grant execute on function public.cancel_bundle_purchase_request(uuid, text) to authenticated;
grant execute on function public.confirm_bundle_purchase_request(uuid) to authenticated;
