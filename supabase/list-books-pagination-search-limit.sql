-- Incremental migration after list-books-pagination.sql.
-- Restores Chinese substring search and caps public page RPC limits.

create or replace function public.list_books_page(
  p_limit int default 24,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null,
  p_department text default null,
  p_max_price int default null,
  p_query text default null
)
returns table (
  id uuid,
  seller_id uuid,
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
    b.created_at,
    b.updated_at
  from public.books b
  where b.review_status = 'approved'
    and b.moderation_visibility = 'visible'
    and b.status <> 'sold'
    and (p_department is null or b.department = p_department)
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null
      or btrim(p_query) = ''
      or (
        b.title || ' ' || b.author || ' ' || b.course || ' ' || b.teacher
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

create or replace function public.count_books_filtered(
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
    and (p_department is null or b.department = p_department)
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null
      or btrim(p_query) = ''
      or (
        b.title || ' ' || b.author || ' ' || b.course || ' ' || b.teacher
      ) ilike '%' || replace(replace(btrim(p_query), '\', '\\'), '%', '\%') || '%' escape '\'
    );
$$;

create or replace function public.list_pending_reviews_page(
  p_limit int default 24,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  seller_id uuid,
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
