-- Add publisher metadata and persist per-user daily quota for server-side AI book-cover recognition.

alter table public.books
  add column if not exists publisher text not null default '';

drop function if exists public.list_books_page(int, timestamptz, uuid, text, text, text, int, text);
create function public.list_books_page(
  p_limit int default 24,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null,
  p_listing_type text default 'book',
  p_item_category text default null,
  p_department text default null,
  p_max_price int default null,
  p_query text default null
)
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
  condition text,
  price int,
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
language sql
stable
security invoker
set search_path = public
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
  where b.review_status = 'approved'
    and b.moderation_visibility = 'visible'
    and b.status <> 'sold'
    and b.lifecycle_state = 'active'
    and b.listing_type = coalesce(nullif(p_listing_type, ''), 'book')
    and (p_item_category is null or b.item_category = p_item_category)
    and (p_department is null or b.department = p_department)
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null
      or btrim(p_query) = ''
      or (
        b.title || ' ' || b.author || ' ' || b.publisher || ' ' || b.course || ' ' || b.teacher || ' ' || b.description || ' ' || b.item_category
      ) ilike '%' || replace(replace(btrim(p_query), '\', '\\'), '%', '\%') || '%' escape '\'
    )
    and (
      p_cursor_created is null
      or p_cursor_id is null
      or (b.created_at, b.id) < (p_cursor_created, p_cursor_id)
    )
  order by b.created_at desc, b.id desc
  limit greatest(least(coalesce(p_limit, 24), 100), 1);
$$;

drop function if exists public.list_pending_reviews_page(int, timestamptz, uuid);
create function public.list_pending_reviews_page(
  p_limit int default 24,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null
)
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
  condition text,
  price int,
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
language sql
stable
security invoker
set search_path = public
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
  where b.review_status = 'pending'
    and (
      p_cursor_created is null
      or p_cursor_id is null
      or (b.created_at, b.id) < (p_cursor_created, p_cursor_id)
    )
  order by b.created_at desc, b.id desc
  limit greatest(least(coalesce(p_limit, 24), 100), 1);
$$;

revoke execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text) from public;
revoke execute on function public.list_pending_reviews_page(int, timestamptz, uuid) from public;
grant execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text) to anon, authenticated;
grant execute on function public.list_pending_reviews_page(int, timestamptz, uuid) to authenticated;

create or replace function public.count_books_filtered(
  p_listing_type text default 'book',
  p_item_category text default null,
  p_department text default null,
  p_max_price int default null,
  p_query text default null
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
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null
      or btrim(p_query) = ''
      or (
        b.title || ' ' || b.author || ' ' || b.publisher || ' ' || b.course || ' ' || b.teacher || ' ' || b.description || ' ' || b.item_category
      ) ilike '%' || replace(replace(btrim(p_query), '\', '\\'), '%', '\%') || '%' escape '\'
    );
$$;

create table if not exists public.book_ocr_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.book_ocr_daily_usage enable row level security;
revoke all on public.book_ocr_daily_usage from public, anon, authenticated;

create or replace function public.consume_book_ocr_quota(
  target_user_id uuid,
  daily_limit integer default 20
)
returns table (
  allowed boolean,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  today_utc date := (timezone('UTC', now()))::date;
  next_count integer;
begin
  if target_user_id is null or daily_limit < 1 or daily_limit > 100 then
    raise exception 'Invalid book OCR quota request';
  end if;

  insert into public.book_ocr_daily_usage (
    user_id,
    usage_date,
    request_count
  ) values (
    target_user_id,
    today_utc,
    1
  )
  on conflict (user_id, usage_date) do nothing
  returning request_count into next_count;

  if next_count is null then
    update public.book_ocr_daily_usage
    set request_count = request_count + 1,
        updated_at = now()
    where user_id = target_user_id
      and usage_date = today_utc
      and request_count < daily_limit
    returning request_count into next_count;
  end if;

  if next_count is null then
    return query select false, 0;
  end if;

  return query select true, greatest(daily_limit - next_count, 0);
end;
$$;

revoke execute on function public.consume_book_ocr_quota(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.consume_book_ocr_quota(uuid, integer)
  to service_role;
