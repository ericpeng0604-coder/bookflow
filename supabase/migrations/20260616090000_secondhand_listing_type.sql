-- Add secondhand listings to the existing marketplace without splitting the trade flow.

alter table public.books
  add column if not exists listing_type text not null default 'book'
    check (listing_type in ('book', 'secondhand')),
  add column if not exists item_category text not null default 'book';

update public.books
set listing_type = coalesce(nullif(listing_type, ''), 'book'),
    item_category = coalesce(nullif(item_category, ''), 'book');

create index if not exists books_public_catalog_type_idx
  on public.books (listing_type, item_category, created_at desc, id desc)
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and status <> 'sold';

drop function if exists public.list_books_page(int, timestamptz, uuid, text, int, text);
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
        b.title || ' ' || b.author || ' ' || b.course || ' ' || b.teacher || ' ' || b.description || ' ' || b.item_category
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

drop function if exists public.count_books_filtered(text, int, text);
drop function if exists public.count_books_filtered(text, text, text, int, text);
create function public.count_books_filtered(
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
        b.title || ' ' || b.author || ' ' || b.course || ' ' || b.teacher || ' ' || b.description || ' ' || b.item_category
      ) ilike '%' || replace(replace(btrim(p_query), '\', '\\'), '%', '\%') || '%' escape '\'
    );
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

drop function if exists public.list_my_books();
create function public.list_my_books()
returns setof public.books
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.books
  where seller_id = auth.uid()
  order by created_at desc, id desc;
$$;

revoke execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text) from public;
revoke execute on function public.count_books_filtered(text, text, text, int, text) from public;
revoke execute on function public.list_pending_reviews_page(int, timestamptz, uuid) from public;
revoke execute on function public.list_my_books() from public;

grant execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text) to anon, authenticated;
grant execute on function public.count_books_filtered(text, text, text, int, text) to anon, authenticated;
grant execute on function public.list_pending_reviews_page(int, timestamptz, uuid) to authenticated;
grant execute on function public.list_my_books() to authenticated;
