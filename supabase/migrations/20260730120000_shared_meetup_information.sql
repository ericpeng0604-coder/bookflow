-- Shared transaction meetup information is editable by both parties unless
-- the listing uses the seller-owned fixed-location mode.

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
  requester uuid := auth.uid();
  target public.purchase_requests;
  listing_seller_id uuid;
  listing_meetup_mode text;
  normalized_location text := left(btrim(coalesce(preferred_location, '')), 120);
  normalized_time text := left(btrim(coalesce(preferred_time, '')), 120);
begin
  if requester is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  select * into target
  from public.purchase_requests
  where id = target_request_id
  for update;

  if target.id is null then
    raise exception 'Transaction not found';
  end if;
  if target.status not in (
    'pending',
    'waitlisted',
    'awaiting_recipient_confirmation',
    'reserved',
    'awaiting_confirmation'
  ) then
    raise exception 'Transaction is no longer editable';
  end if;

  select b.seller_id,
    case
      when b.meetup_mode in ('mutual_discussion', 'applicant_preferred') then b.meetup_mode
      else 'fixed_location'
    end
    into listing_seller_id, listing_meetup_mode
  from public.books b
  where b.id = target.book_id;

  if listing_seller_id is null then
    raise exception 'Listing not found';
  end if;
  if requester <> target.buyer_id and requester <> listing_seller_id then
    raise exception 'Transaction participant required';
  end if;

  if target.purchase_order_id is not null then
    if requester <> listing_seller_id and exists (
      select 1
      from public.purchase_requests sibling
      join public.books sibling_book on sibling_book.id = sibling.book_id
      where sibling.purchase_order_id = target.purchase_order_id
        and sibling_book.meetup_mode not in ('mutual_discussion', 'applicant_preferred')
    ) then
      raise exception 'Only the listing seller can edit a fixed meetup location';
    end if;

    update public.purchase_orders
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where id = target.purchase_order_id
      and (buyer_id = requester or seller_id = requester);

    update public.purchase_requests
    set preferred_meetup_location = normalized_location,
        preferred_meetup_time = normalized_time,
        updated_at = now()
    where purchase_order_id = target.purchase_order_id;
    return;
  end if;

  if listing_meetup_mode = 'fixed_location' and requester <> listing_seller_id then
    raise exception 'Only the listing seller can edit a fixed meetup location';
  end if;

  update public.purchase_requests
  set preferred_meetup_location = normalized_location,
      preferred_meetup_time = normalized_time,
      updated_at = now()
  where id = target.id
    and status = target.status;

  if not found then
    raise exception 'Transaction changed while saving meetup information';
  end if;
end;
$$;

revoke all on function public.update_purchase_request_coordination(uuid, text, text) from public, anon;
grant execute on function public.update_purchase_request_coordination(uuid, text, text) to authenticated;
