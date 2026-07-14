-- Prevent refresh/race windows from creating duplicate active purchase requests.
drop index if exists public.purchase_requests_one_active_per_buyer;
create unique index purchase_requests_one_active_per_buyer
  on public.purchase_requests (book_id, buyer_id)
  where status in ('pending', 'waitlisted', 'reserved', 'awaiting_confirmation');

drop function if exists public.create_purchase_request(uuid, text, text, text);
create function public.create_purchase_request(
  target_book_id uuid,
  request_message text default '',
  preferred_meetup_location text default '',
  preferred_meetup_time text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  locked_book_id uuid;
  requester uuid := auth.uid();
  existing_request uuid;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  select id into locked_book_id
  from public.books
    where id = target_book_id
      and seller_id <> requester
      and status = 'available'
      and lifecycle_state = 'active'
      and review_status = 'approved'
      and moderation_visibility = 'visible'
  for update;

  if locked_book_id is null then
    raise exception 'Listing unavailable';
  end if;

  select id into existing_request
  from public.purchase_requests
  where book_id = target_book_id
    and buyer_id = requester
    and status in ('pending', 'waitlisted', 'reserved', 'awaiting_confirmation')
  order by created_at desc
  limit 1
  for update;

  if existing_request is not null then
    update public.purchase_requests
    set message = left(coalesce(request_message, ''), 500),
        preferred_meetup_location = left(coalesce(create_purchase_request.preferred_meetup_location, ''), 120),
        preferred_meetup_time = left(coalesce(create_purchase_request.preferred_meetup_time, ''), 120),
        updated_at = now()
    where id = existing_request;
    return existing_request;
  end if;

  insert into public.purchase_requests (
    book_id, buyer_id, message, preferred_meetup_location, preferred_meetup_time, status
  ) values (
    target_book_id,
    requester,
    left(coalesce(request_message, ''), 500),
    left(coalesce(preferred_meetup_location, ''), 120),
    left(coalesce(preferred_meetup_time, ''), 120),
    'pending'
  ) returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.create_purchase_request(uuid, text, text, text) from public, anon;
grant execute on function public.create_purchase_request(uuid, text, text, text) to authenticated;

-- Expand the catalog RPCs with an inclusive minimum-price filter. The defaults
-- keep older application versions compatible while the new client rolls out.
drop function if exists public.list_books_page(int, timestamptz, uuid, text, text, text, int, text);
create function public.list_books_page(
  p_limit int default 24,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null,
  p_listing_type text default 'book',
  p_item_category text default null,
  p_department text default null,
  p_max_price int default null,
  p_query text default null,
  p_min_price int default null
)
returns setof public.books
language sql
stable
security invoker
set search_path = public
as $$
  select b.*
  from public.books b
  where b.review_status = 'approved'
    and b.moderation_visibility = 'visible'
    and b.status <> 'sold'
    and b.lifecycle_state = 'active'
    and b.listing_type = coalesce(nullif(p_listing_type, ''), 'book')
    and (p_item_category is null or b.item_category = p_item_category)
    and (p_department is null or b.department = p_department)
    and (p_min_price is null or b.price >= p_min_price)
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null
      or btrim(p_query) = ''
      or not exists (
        select 1
        from regexp_split_to_table(lower(btrim(p_query)), '\s+') as search_token(token)
        where token <> ''
          and position(token in lower(concat_ws(' ', b.title, b.author, b.publisher, b.course, b.teacher,
            b.description, b.item_category, b.education_level, b.grade, b.subject, b.volume,
            b.curriculum, b.book_type, b.isbn13, b.approval_number))) = 0
      )
    )
    and (
      p_cursor_created is null
      or p_cursor_id is null
      or (b.created_at, b.id) < (p_cursor_created, p_cursor_id)
    )
  order by b.created_at desc, b.id desc
  limit greatest(least(coalesce(p_limit, 24), 100), 1);
$$;

drop function if exists public.count_books_filtered(text, text, text, int, text);
create function public.count_books_filtered(
  p_listing_type text default 'book',
  p_item_category text default null,
  p_department text default null,
  p_max_price int default null,
  p_query text default null,
  p_min_price int default null
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.books b
  where b.review_status = 'approved'
    and b.moderation_visibility = 'visible'
    and b.status <> 'sold'
    and b.lifecycle_state = 'active'
    and b.listing_type = coalesce(nullif(p_listing_type, ''), 'book')
    and (p_item_category is null or b.item_category = p_item_category)
    and (p_department is null or b.department = p_department)
    and (p_min_price is null or b.price >= p_min_price)
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null
      or btrim(p_query) = ''
      or not exists (
        select 1
        from regexp_split_to_table(lower(btrim(p_query)), '\s+') as search_token(token)
        where token <> ''
          and position(token in lower(concat_ws(' ', b.title, b.author, b.publisher, b.course, b.teacher,
            b.description, b.item_category, b.education_level, b.grade, b.subject, b.volume,
            b.curriculum, b.book_type, b.isbn13, b.approval_number))) = 0
      )
    );
$$;

revoke execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text, int) from public;
revoke execute on function public.count_books_filtered(text, text, text, int, text, int) from public;
grant execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text, int) to anon, authenticated;
grant execute on function public.count_books_filtered(text, text, text, int, text, int) to anon, authenticated;
