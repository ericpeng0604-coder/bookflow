-- Meetup modes for secondhand items and zero-price giveaways.
-- Existing rows remain fixed-location listings for backwards compatibility.

alter table public.books
  add column if not exists meetup_mode text not null default 'fixed_location';

update public.books
set meetup_mode = 'fixed_location'
where meetup_mode is null or btrim(meetup_mode) = '';

alter table public.books
  drop constraint if exists books_meetup_mode_check,
  drop constraint if exists books_meetup_length_check;

alter table public.books
  add constraint books_meetup_mode_check
    check (meetup_mode in ('fixed_location', 'mutual_discussion', 'applicant_preferred')) not valid,
  add constraint books_meetup_length_check
    check (
      (meetup_mode = 'fixed_location' and char_length(btrim(meetup)) between 1 and 160)
      or (meetup_mode in ('mutual_discussion', 'applicant_preferred') and btrim(meetup) = '')
    ) not valid;

revoke update on table public.books from authenticated;
grant update (
  listing_type, item_category, title, author, department, course, teacher,
  edition, publisher, education_level, grade, semester, subject, volume,
  curriculum, book_type, isbn13, approval_number, condition, price,
  image_url, image_urls, meetup_mode, meetup, description, updated_at
) on table public.books to authenticated;

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
    new.listing_type, new.item_category, new.title, new.author, new.department,
    new.course, new.teacher, new.edition, new.publisher, new.education_level,
    new.grade, new.semester, new.subject, new.volume, new.curriculum,
    new.book_type, new.isbn13, new.approval_number, new.condition, new.price,
    new.image_url, new.image_urls, new.meetup_mode, new.meetup, new.description
  ) is distinct from (
    old.listing_type, old.item_category, old.title, old.author, old.department,
    old.course, old.teacher, old.edition, old.publisher, old.education_level,
    old.grade, old.semester, old.subject, old.volume, old.curriculum,
    old.book_type, old.isbn13, old.approval_number, old.condition, old.price,
    old.image_url, old.image_urls, old.meetup_mode, old.meetup, old.description
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
  id uuid, seller_id uuid, seller_verified boolean, listing_type text,
  item_category text, title text, author text, department text, course text,
  teacher text, edition text, publisher text, condition text, price int,
  image_url text, image_urls text[], meetup_mode text, meetup text,
  description text, status public.book_status, review_status text,
  review_note text, education_level text, grade text, semester text,
  subject text, volume text, curriculum text, book_type text, isbn13 text,
  approval_number text, moderation_visibility text, lifecycle_state text,
  listing_confirmed_at timestamptz, archived_at timestamptz,
  archive_reason text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  with catalog as (
    select b.*,
      exists (
        select 1 from public.student_verifications verification
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
        p_query is null or btrim(p_query) = '' or not exists (
          select 1 from regexp_split_to_table(lower(btrim(p_query)), '\s+') as search_token(token)
          where token <> '' and position(token in lower(concat_ws(' ', b.title, b.author,
            b.publisher, b.course, b.teacher, b.description, b.item_category,
            b.education_level, b.grade, b.subject, b.volume, b.curriculum,
            b.book_type, b.isbn13, b.approval_number))) = 0
        )
      )
  )
  select catalog.id, catalog.seller_id, catalog.verified, catalog.listing_type,
    catalog.item_category, catalog.title, catalog.author, catalog.department,
    catalog.course, catalog.teacher, catalog.edition, catalog.publisher,
    catalog.condition, catalog.price, catalog.image_url, catalog.image_urls,
    catalog.meetup_mode, catalog.meetup, catalog.description, catalog.status,
    catalog.review_status, catalog.review_note, catalog.education_level,
    catalog.grade, catalog.semester, catalog.subject, catalog.volume,
    catalog.curriculum, catalog.book_type, catalog.isbn13, catalog.approval_number,
    catalog.moderation_visibility, catalog.lifecycle_state,
    catalog.listing_confirmed_at, catalog.archived_at, catalog.archive_reason,
    catalog.created_at, catalog.updated_at
  from catalog
  where p_cursor_verified is null or p_cursor_created is null or p_cursor_id is null
    or (catalog.verified, catalog.created_at, catalog.id)
      < (p_cursor_verified, p_cursor_created, p_cursor_id)
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
  id uuid, seller_id uuid, listing_type text, item_category text, title text,
  author text, department text, course text, teacher text, edition text,
  publisher text, education_level text, grade text, semester text, subject text,
  volume text, curriculum text, book_type text, isbn13 text, approval_number text,
  condition text, price int, image_url text, image_urls text[], meetup_mode text,
  meetup text, description text, status public.book_status, review_status text,
  review_note text, moderation_visibility text, lifecycle_state text,
  listing_confirmed_at timestamptz, archived_at timestamptz,
  archive_reason text, created_at timestamptz, updated_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select b.id, b.seller_id, b.listing_type, b.item_category, b.title, b.author,
    b.department, b.course, b.teacher, b.edition, b.publisher,
    b.education_level, b.grade, b.semester, b.subject, b.volume, b.curriculum,
    b.book_type, b.isbn13, b.approval_number, b.condition, b.price,
    b.image_url, b.image_urls, b.meetup_mode, b.meetup, b.description, b.status,
    b.review_status, b.review_note, b.moderation_visibility, b.lifecycle_state,
    b.listing_confirmed_at, b.archived_at, b.archive_reason, b.created_at,
    b.updated_at
  from public.books b
  where b.review_status = 'pending'
    and (p_cursor_created is null or p_cursor_id is null
      or (b.created_at, b.id) < (p_cursor_created, p_cursor_id))
  order by b.created_at desc, b.id desc
  limit greatest(least(coalesce(p_limit, 24), 100), 1);
$$;

revoke execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text, int, boolean
) from public;
grant execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text, int, boolean
) to anon, authenticated;
revoke execute on function public.list_pending_reviews_page(int, timestamptz, uuid) from public;
grant execute on function public.list_pending_reviews_page(int, timestamptz, uuid) to authenticated;

create or replace function public.notify_giveaway_listing_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare item record;
begin
  if new.listing_type <> 'giveaway' or (
    old.title = new.title and old.description = new.description
    and old.meetup_mode = new.meetup_mode and old.meetup = new.meetup
    and old.condition = new.condition and old.image_url = new.image_url
    and old.image_urls = new.image_urls
  ) then return new; end if;
  for item in select distinct buyer_id from public.purchase_requests
    where book_id = new.id and status in (
      'pending', 'waitlisted', 'awaiting_recipient_confirmation', 'reserved', 'awaiting_confirmation'
    ) loop
    insert into public.notifications (recipient_id, actor_id, type, book_id, title, message, dedupe_key)
      values (item.buyer_id, new.seller_id, 'listing_lifecycle', new.id,
        '零元贈送內容已更新', '「' || new.title || '」的刊登內容已更新，請重新確認領取安排。',
        'giveaway-listing-updated:' || new.id::text || ':' || extract(epoch from now())::bigint)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end loop;
  return new;
end;
$$;
