-- Multi-item cart checkout keeps the existing purchase_requests rows as child items.
-- The parent is always scoped to one buyer/seller pair; legacy single-item rows keep
-- purchase_order_id NULL and continue using the existing RPCs.

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'partially_accepted', 'reserved', 'awaiting_confirmation',
    'completed', 'partially_rejected', 'cancelled', 'expired'
  )),
  message text not null default '',
  preferred_meetup_location text not null default '',
  preferred_meetup_time text not null default '',
  total_price integer not null default 0 check (total_price >= 0),
  item_count integer not null default 0 check (item_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchase_requests
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;

alter table public.conversations
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;

create table if not exists public.purchase_cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index if not exists purchase_requests_purchase_order_id_idx
  on public.purchase_requests (purchase_order_id, created_at desc);
create unique index if not exists conversations_purchase_order_id_idx
  on public.conversations (purchase_order_id)
  where purchase_order_id is not null;

alter table public.purchase_orders enable row level security;
alter table public.purchase_cart_items enable row level security;

drop policy if exists "purchase orders visible to their parties" on public.purchase_orders;
create policy "purchase orders visible to their parties"
  on public.purchase_orders for select to authenticated
  using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);

drop policy if exists "users can view their cart" on public.purchase_cart_items;
create policy "users can view their cart"
  on public.purchase_cart_items for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can manage their cart" on public.purchase_cart_items;
create policy "users can manage their cart"
  on public.purchase_cart_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.purchase_cart_items to authenticated;

create or replace function public.refresh_purchase_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  pending_count integer;
  accepted_count integer;
  rejected_count integer;
  next_status text;
begin
  if new.purchase_order_id is null then return new; end if;

  select count(*) into total_count from public.purchase_requests where purchase_order_id = new.purchase_order_id;
  select count(*) into pending_count from public.purchase_requests
    where purchase_order_id = new.purchase_order_id and status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation');
  select count(*) into accepted_count from public.purchase_requests
    where purchase_order_id = new.purchase_order_id and status in ('reserved', 'awaiting_confirmation', 'completed');
  select count(*) into rejected_count from public.purchase_requests
    where purchase_order_id = new.purchase_order_id and status in ('rejected', 'cancelled', 'expired');

  next_status := case
    when total_count = 0 or rejected_count = total_count then 'cancelled'
    when accepted_count = total_count then
      case when exists (
        select 1 from public.purchase_requests where purchase_order_id = new.purchase_order_id and status = 'completed'
      ) then 'completed' else 'reserved' end
    when accepted_count > 0 and rejected_count > 0 then 'partially_rejected'
    when accepted_count > 0 then 'partially_accepted'
    when rejected_count > 0 and pending_count > 0 then 'partially_rejected'
    else 'pending'
  end;

  update public.purchase_orders
    set status = next_status, updated_at = now()
    where id = new.purchase_order_id;
  return new;
end;
$$;

drop trigger if exists purchase_request_refresh_order_status on public.purchase_requests;
create trigger purchase_request_refresh_order_status
  after insert or update of status, purchase_order_id on public.purchase_requests
  for each row execute function public.refresh_purchase_order_status();

create or replace function public.create_purchase_order(
  p_book_ids uuid[],
  p_message text default '',
  p_preferred_meetup_location text default '',
  p_preferred_meetup_time text default ''
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  distinct_count integer;
  selected_count integer;
  seller_row record;
  book_row record;
  order_id uuid;
  normalized_location text := left(trim(coalesce(p_preferred_meetup_location, '')), 120);
  normalized_time text := left(trim(coalesce(p_preferred_meetup_time, '')), 120);
begin
  if requester is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if coalesce(array_length(p_book_ids, 1), 0) = 0 then raise exception 'At least one item is required'; end if;

  select count(distinct id), count(*) into distinct_count, selected_count
    from unnest(p_book_ids) as ids(id);
  if distinct_count <> selected_count then raise exception 'Duplicate items are not allowed'; end if;

  select count(*) into selected_count
    from public.books
    where id = any(p_book_ids)
      and seller_id <> requester
      and status = 'available'
      and lifecycle_state = 'active'
      and review_status = 'approved';
  if selected_count <> distinct_count then raise exception 'One or more items are unavailable'; end if;

  if exists (
    select 1 from public.purchase_requests
    where buyer_id = requester and book_id = any(p_book_ids)
      and status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation', 'reserved', 'awaiting_confirmation')
  ) then raise exception 'One or more items already have an active request'; end if;

  for seller_row in
    select seller_id, count(*) as item_count,
      sum(case when listing_type = 'giveaway' then 0 else price end)::integer as total_price
    from public.books where id = any(p_book_ids) group by seller_id
  loop
    if (
      select count(distinct nullif(trim(meetup), ''))
      from public.books where id = any(p_book_ids) and seller_id = seller_row.seller_id
    ) > 1 then
      raise exception 'Items from the same seller have different meetup locations';
    end if;

    insert into public.purchase_orders (buyer_id, seller_id, message, preferred_meetup_location, preferred_meetup_time, total_price, item_count)
      values (requester, seller_row.seller_id, left(trim(coalesce(p_message, '')), 2000), normalized_location, normalized_time, seller_row.total_price, seller_row.item_count)
      returning id into order_id;
    return next order_id;

    for book_row in select * from public.books where id = any(p_book_ids) and seller_id = seller_row.seller_id order by id for update
    loop
      insert into public.purchase_requests (
        book_id, buyer_id, message, status, title_snapshot, price_snapshot, edition_snapshot,
        image_snapshot, meetup_snapshot, cancellation_reason, preferred_meetup_location, preferred_meetup_time,
        purchase_order_id
      ) values (
        book_row.id, requester, left(trim(coalesce(p_message, '')), 2000), 'pending', book_row.title,
        case when book_row.listing_type = 'giveaway' then 0 else book_row.price end, book_row.edition,
        book_row.image_url, book_row.meetup, '', normalized_location, normalized_time, order_id
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.open_purchase_order_conversation(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  order_row public.purchase_orders%rowtype;
  anchor_book uuid;
  conversation_id uuid;
begin
  if requester is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into order_row from public.purchase_orders where id = p_order_id and (buyer_id = requester or seller_id = requester);
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  select book_id into anchor_book from public.purchase_requests where purchase_order_id = p_order_id order by created_at, id limit 1;
  select id into conversation_id from public.conversations where purchase_order_id = p_order_id limit 1;
  if conversation_id is null then
    insert into public.conversations (book_id, buyer_id, seller_id, purchase_order_id)
      values (anchor_book, order_row.buyer_id, order_row.seller_id, p_order_id)
      returning id into conversation_id;
  end if;
  return conversation_id;
end;
$$;

create or replace function public.reject_purchase_order_item(target_request_id uuid, reason text default 'seller_rejected_item')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
begin
  if requester is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.purchase_requests request_row
    set status = 'rejected', cancellation_reason = left(trim(coalesce(reason, 'seller_rejected_item')), 120), updated_at = now()
    from public.books book_row
    where request_row.id = target_request_id
      and book_row.id = request_row.book_id
      and book_row.seller_id = requester
      and request_row.status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation');
  if not found then raise exception 'Request is not available for seller rejection'; end if;
end;
$$;

revoke all on function public.create_purchase_order(uuid[], text, text, text) from public, anon;
grant execute on function public.create_purchase_order(uuid[], text, text, text) to authenticated;
revoke all on function public.open_purchase_order_conversation(uuid) from public, anon;
grant execute on function public.open_purchase_order_conversation(uuid) to authenticated;
revoke all on function public.reject_purchase_order_item(uuid, text) from public, anon;
grant execute on function public.reject_purchase_order_item(uuid, text) to authenticated;
