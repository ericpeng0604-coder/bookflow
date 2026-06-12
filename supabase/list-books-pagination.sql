-- Run after reports-and-suspensions.sql in the Supabase SQL Editor.

create index if not exists books_public_catalog_idx
  on public.books (created_at desc, id desc)
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and status <> 'sold';

create index if not exists books_public_catalog_dept_idx
  on public.books (department, created_at desc, id desc)
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and status <> 'sold';

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

create or replace function public.list_my_books()
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
  where b.seller_id = auth.uid()
  order by b.created_at desc, b.id desc;
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

create or replace function public.get_trade_contacts_batch(p_request_ids uuid[])
returns table (
  request_id uuid,
  id uuid,
  name text,
  email text,
  department text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_request_id uuid;
begin
  if p_request_ids is null or array_length(p_request_ids, 1) is null then
    return;
  end if;

  foreach target_request_id in array p_request_ids loop
    return query
    select target_request_id, contact.id, contact.name, contact.email, contact.department
    from public.get_trade_contact(target_request_id) as contact;
  end loop;
end;
$$;

revoke execute on function public.list_books_page(int, timestamptz, uuid, text, int, text) from public;
revoke execute on function public.count_books_filtered(text, int, text) from public;
revoke execute on function public.list_my_books() from public;
revoke execute on function public.list_pending_reviews_page(int, timestamptz, uuid) from public;
revoke execute on function public.get_trade_contacts_batch(uuid[]) from public;

grant execute on function public.list_books_page(int, timestamptz, uuid, text, int, text) to anon, authenticated;
grant execute on function public.count_books_filtered(text, int, text) to anon, authenticated;
grant execute on function public.list_my_books() to authenticated;
grant execute on function public.list_pending_reviews_page(int, timestamptz, uuid) to authenticated;
grant execute on function public.get_trade_contacts_batch(uuid[]) to authenticated;
