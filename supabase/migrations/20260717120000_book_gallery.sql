-- Store an ordered gallery while keeping image_url as the cover-image
-- compatibility field used by older clients and transaction snapshots.
alter table public.books
  add column if not exists image_urls text[] not null default '{}';

update public.books
set image_urls = array[image_url]
where coalesce(cardinality(image_urls), 0) = 0
  and image_url <> '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'books_image_urls_limit'
      and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_image_urls_limit
      check (cardinality(image_urls) between 0 and 6);
  end if;
end;
$$;

create or replace function public.enforce_book_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_moderator() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.review_note := '';
    new.reviewed_at := null;
    new.reviewed_by := null;
    return new;
  end if;

  if (
    new.listing_type, new.item_category, new.title, new.author,
    new.department, new.course, new.teacher, new.edition, new.publisher,
    new.education_level, new.grade, new.semester, new.subject, new.volume,
    new.curriculum, new.book_type, new.isbn13, new.approval_number,
    new.condition, new.price, new.image_url, new.image_urls, new.meetup,
    new.description
  ) is distinct from (
    old.listing_type, old.item_category, old.title, old.author,
    old.department, old.course, old.teacher, old.edition, old.publisher,
    old.education_level, old.grade, old.semester, old.subject, old.volume,
    old.curriculum, old.book_type, old.isbn13, old.approval_number,
    old.condition, old.price, old.image_url, old.image_urls, old.meetup,
    old.description
  ) then
    new.review_status := 'pending';
    new.review_note := '';
    new.reviewed_at := null;
    new.reviewed_by := null;
  else
    new.review_status := old.review_status;
    new.review_note := old.review_note;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
  end if;
  return new;
end;
$$;

create or replace function public.clear_book_gallery_when_cover_cleared()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.image_url = '' then
    new.image_urls := '{}';
  end if;
  return new;
end;
$$;

drop trigger if exists clear_book_gallery_when_cover_cleared on public.books;
create trigger clear_book_gallery_when_cover_cleared
before insert or update on public.books
for each row execute function public.clear_book_gallery_when_cover_cleared();

drop function if exists public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text, int, boolean
);
create function public.list_books_page(
  p_limit int default 24,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null,
  p_listing_type text default 'book',
  p_item_category text default null,
  p_department text default null,
  p_max_price int default null,
  p_query text default null,
  p_min_price int default null,
  p_cursor_verified boolean default null
)
returns table (
  id uuid,
  seller_id uuid,
  seller_verified boolean,
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
  image_urls text[],
  meetup text,
  description text,
  status public.book_status,
  review_status text,
  review_note text,
  education_level text,
  grade text,
  semester text,
  subject text,
  volume text,
  curriculum text,
  book_type text,
  isbn13 text,
  approval_number text,
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
security definer
set search_path = public
as $$
  with catalog as (
    select
      b.*,
      exists (
        select 1
        from public.student_verifications verification
        where verification.user_id = b.seller_id
          and verification.status = 'approved'
          and verification.admission_year between
            (extract(year from timezone('Asia/Taipei', now()))::int - 1911 - 4)
            and (extract(year from timezone('Asia/Taipei', now()))::int - 1911)
      ) as verified
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
  )
  select
    catalog.id, catalog.seller_id, catalog.verified, catalog.listing_type,
    catalog.item_category, catalog.title, catalog.author, catalog.department,
    catalog.course, catalog.teacher, catalog.edition, catalog.publisher,
    catalog.condition, catalog.price, catalog.image_url, catalog.image_urls,
    catalog.meetup, catalog.description, catalog.status, catalog.review_status,
    catalog.review_note, catalog.education_level, catalog.grade,
    catalog.semester, catalog.subject, catalog.volume, catalog.curriculum,
    catalog.book_type, catalog.isbn13, catalog.approval_number,
    catalog.moderation_visibility, catalog.lifecycle_state,
    catalog.listing_confirmed_at, catalog.archived_at, catalog.archive_reason,
    catalog.created_at, catalog.updated_at
  from catalog
  where (
    p_cursor_verified is null
    or p_cursor_created is null
    or p_cursor_id is null
    or (catalog.verified, catalog.created_at, catalog.id)
      < (p_cursor_verified, p_cursor_created, p_cursor_id)
  )
  order by catalog.verified desc, catalog.created_at desc, catalog.id desc
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
  price int,
  image_url text,
  image_urls text[],
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
    b.id, b.seller_id, b.listing_type, b.item_category, b.title, b.author,
    b.department, b.course, b.teacher, b.edition, b.publisher,
    b.education_level, b.grade, b.semester, b.subject, b.volume,
    b.curriculum, b.book_type, b.isbn13, b.approval_number, b.condition,
    b.price, b.image_url, b.image_urls, b.meetup, b.description, b.status,
    b.review_status, b.review_note, b.moderation_visibility,
    b.lifecycle_state, b.listing_confirmed_at, b.archived_at,
    b.archive_reason, b.created_at, b.updated_at
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

revoke execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text, int, boolean
) from public;
grant execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text, int, boolean
) to anon, authenticated;
revoke execute on function public.list_pending_reviews_page(int, timestamptz, uuid)
  from public;
grant execute on function public.list_pending_reviews_page(int, timestamptz, uuid)
  to authenticated;
