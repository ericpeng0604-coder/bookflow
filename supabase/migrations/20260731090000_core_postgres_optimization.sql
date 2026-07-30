-- BookFlow core PostgreSQL performance and RLS hardening.
--
-- This migration keeps the public list_books_page signature and cursor shape
-- stable while replacing per-row student verification lookups with a small,
-- maintained projection on books. Risk moderation pagination moves from OFFSET
-- to a deterministic keyset cursor.

create schema if not exists private;

alter table public.books
  add column if not exists seller_verified boolean not null default false;

-- The projection is intentionally limited to the public badge rule. No private
-- verification fields are copied onto books.
update public.books b
set seller_verified = exists (
  select 1
  from public.student_verifications verification
  where verification.user_id = b.seller_id
    and verification.status = 'approved'
    and verification.admission_year between
      (extract(year from timezone('Asia/Taipei', now()))::int - 1911 - 4)
      and (extract(year from timezone('Asia/Taipei', now()))::int - 1911)
);

create index if not exists books_public_catalog_verified_idx
  on public.books (listing_type, seller_verified desc, created_at desc, id desc)
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and status <> 'sold'
    and lifecycle_state = 'active';

create index if not exists books_public_catalog_category_verified_idx
  on public.books (listing_type, item_category, seller_verified desc, created_at desc, id desc)
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and status <> 'sold'
    and lifecycle_state = 'active';

-- These indexes cover the newer order tables whose RLS policies filter by
-- participant and whose UI reads are ordered by creation time.
create index if not exists purchase_orders_buyer_created_idx
  on public.purchase_orders (buyer_id, created_at desc, id desc);

create index if not exists purchase_orders_seller_created_idx
  on public.purchase_orders (seller_id, created_at desc, id desc);

create index if not exists purchase_requests_book_created_idx
  on public.purchase_requests (book_id, created_at desc, id desc);

create or replace function private.recompute_books_seller_verified(target_seller_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  update public.books b
  set seller_verified = exists (
    select 1
    from public.student_verifications verification
    where verification.user_id = target_seller_id
      and verification.status = 'approved'
      and verification.admission_year between
        (extract(year from timezone('Asia/Taipei', now()))::int - 1911 - 4)
        and (extract(year from timezone('Asia/Taipei', now()))::int - 1911)
  )
  where b.seller_id = target_seller_id
    and b.seller_verified is distinct from exists (
      select 1
      from public.student_verifications verification
      where verification.user_id = target_seller_id
        and verification.status = 'approved'
        and verification.admission_year between
          (extract(year from timezone('Asia/Taipei', now()))::int - 1911 - 4)
          and (extract(year from timezone('Asia/Taipei', now()))::int - 1911)
    );

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function private.sync_books_seller_verified_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recompute_books_seller_verified(old.user_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform private.recompute_books_seller_verified(old.user_id);
  end if;
  perform private.recompute_books_seller_verified(new.user_id);
  return new;
end;
$$;

drop trigger if exists sync_books_seller_verified on public.student_verifications;
create trigger sync_books_seller_verified
  after insert or delete or update of user_id, status, admission_year
  on public.student_verifications
  for each row execute function private.sync_books_seller_verified_trigger();

create or replace function public.recompute_all_books_seller_verified()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  update public.books b
  set seller_verified = exists (
    select 1
    from public.student_verifications verification
    where verification.user_id = b.seller_id
      and verification.status = 'approved'
      and verification.admission_year between
        (extract(year from timezone('Asia/Taipei', now()))::int - 1911 - 4)
        and (extract(year from timezone('Asia/Taipei', now()))::int - 1911)
  )
  where b.seller_verified is distinct from exists (
    select 1
    from public.student_verifications verification
    where verification.user_id = b.seller_id
      and verification.status = 'approved'
      and verification.admission_year between
        (extract(year from timezone('Asia/Taipei', now()))::int - 1911 - 4)
        and (extract(year from timezone('Asia/Taipei', now()))::int - 1911)
  );

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

revoke all on function private.recompute_books_seller_verified(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_books_seller_verified_trigger()
  from public, anon, authenticated, service_role;
revoke all on function public.recompute_all_books_seller_verified()
  from public, anon, authenticated;
grant execute on function public.recompute_all_books_seller_verified() to service_role;

-- Cache the caller identity once per statement in the current books policies.
alter policy "Approved active books are public and parties can review records"
  on public.books
  using (
    (
      review_status = 'approved'
      and moderation_visibility = 'visible'
      and lifecycle_state = 'active'
      and status <> 'sold'
    )
    or seller_id = (select auth.uid())
    or (select public.is_moderator())
    or (select public.is_book_buyer(id))
  );

alter policy "Active users can create pending listings"
  on public.books
  with check (
    (select auth.uid()) = seller_id
    and (select public.is_active_user())
    and review_status = 'pending'
    and moderation_visibility = 'visible'
    and lifecycle_state = 'active'
    and seller_verified = false
  );

alter policy "Active sellers can update their listings"
  on public.books
  using (
    ((select auth.uid()) = seller_id and (select public.is_active_user()))
    or (select public.is_moderator())
  )
  with check (
    (select public.is_moderator())
    or (
      (select auth.uid()) = seller_id
      and (select public.is_active_user())
      and moderation_visibility = 'visible'
      and lifecycle_state = 'active'
    )
  );

alter policy "Active sellers and moderators can delete listings"
  on public.books
  using (
    ((select auth.uid()) = seller_id and (select public.is_active_user()))
    or (select public.is_moderator())
  );

-- Preserve the public API and meetup-mode columns from the latest list RPC,
-- but read the maintained projection instead of probing student_verifications
-- for every candidate row.
create or replace function public.list_books_page(
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
language sql stable security definer
set search_path = public
as $$
  select
    b.id, b.seller_id, b.seller_verified, b.listing_type, b.item_category,
    b.title, b.author, b.department, b.course, b.teacher, b.edition,
    b.publisher, b.condition, b.price, b.image_url, b.image_urls,
    b.meetup_mode, b.meetup, b.description, b.status, b.review_status,
    b.review_note, b.education_level, b.grade, b.semester, b.subject,
    b.volume, b.curriculum, b.book_type, b.isbn13, b.approval_number,
    b.moderation_visibility, b.lifecycle_state, b.listing_confirmed_at,
    b.archived_at, b.archive_reason, b.created_at, b.updated_at
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
          and position(token in lower(concat_ws(' ', b.title, b.author,
            b.publisher, b.course, b.teacher, b.description, b.item_category,
            b.education_level, b.grade, b.subject, b.volume, b.curriculum,
            b.book_type, b.isbn13, b.approval_number))) = 0
      )
    )
    and (
      p_cursor_verified is null
      or p_cursor_created is null
      or p_cursor_id is null
      or (b.seller_verified, b.created_at, b.id)
        < (p_cursor_verified, p_cursor_created, p_cursor_id)
    )
  order by b.seller_verified desc, b.created_at desc, b.id desc
  limit greatest(least(coalesce(p_limit, 24), 100), 1);
$$;

revoke execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text, int, boolean
) from public;
grant execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text, int, boolean
) to anon, authenticated;

-- Keyset cursor for moderator risk ordering:
-- high/medium/low rank ascending, then score/time descending, id ascending.
drop function if exists public.list_risk_profiles_for_moderation(
  text, text, text, text, text, integer, integer
);

create or replace function public.list_risk_profiles_for_moderation(
  p_scope text default 'queue',
  p_status text default 'pending',
  p_risk_level text default 'all',
  p_query text default '',
  p_department text default '',
  p_limit integer default 20,
  p_cursor_risk_rank integer default null,
  p_cursor_score integer default null,
  p_cursor_computed_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  user_id uuid, user_name text, user_department text,
  completed_trade_count integer, review_count integer, average_rating numeric,
  low_rating_count integer, resolved_report_count integer,
  serious_report_count integer, risk_score integer, risk_level text,
  seller_badge_eligible boolean, buyer_badge_eligible boolean,
  seller_badge_status text, buyer_badge_status text, review_status text,
  review_updated_at timestamptz, computed_at timestamptz, total_count bigint
)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not (select public.is_moderator()) then
    raise exception 'Moderator permission required';
  end if;
  if p_scope not in ('queue', 'all') then raise exception 'Invalid risk scope'; end if;
  if p_status not in ('pending', 'viewed', 'processed', 'all') then raise exception 'Invalid risk review status'; end if;
  if p_risk_level not in ('low', 'medium', 'high', 'all') then raise exception 'Invalid risk level'; end if;

  return query
    with candidates as (
      select
        profile.id, profile.name, profile.department,
        coalesce(risk.completed_trade_count, 0) as completed_trade_count,
        coalesce(risk.review_count, 0) as review_count,
        coalesce(risk.average_rating, 0) as average_rating,
        coalesce(risk.low_rating_count, 0) as low_rating_count,
        coalesce(risk.resolved_report_count, 0) as resolved_report_count,
        coalesce(risk.serious_report_count, 0) as serious_report_count,
        coalesce(risk.risk_score, 0) as risk_score,
        coalesce(risk.risk_level, 'low') as risk_level,
        case coalesce(risk.risk_level, 'low') when 'high' then 0 when 'medium' then 1 else 2 end as risk_rank,
        coalesce(risk.seller_badge_eligible, false) as seller_badge_eligible,
        coalesce(risk.buyer_badge_eligible, false) as buyer_badge_eligible,
        seller_badge.status as seller_badge_status,
        buyer_badge.status as buyer_badge_status,
        coalesce(review_state.status, 'pending') as review_status,
        review_state.updated_at as review_updated_at,
        coalesce(risk.computed_at, profile.created_at) as computed_at
      from public.profiles profile
      left join public.risk_profiles risk on risk.user_id = profile.id
      left join public.risk_review_states review_state on review_state.user_id = profile.id
      left join public.trust_badges seller_badge
        on seller_badge.user_id = profile.id and seller_badge.badge_type = 'seller'
      left join public.trust_badges buyer_badge
        on buyer_badge.user_id = profile.id and buyer_badge.badge_type = 'buyer'
      where (p_scope = 'all' or coalesce(risk.risk_level, 'low') in ('high', 'medium'))
        and (p_status = 'all' or coalesce(review_state.status, 'pending') = p_status)
        and (p_risk_level = 'all' or coalesce(risk.risk_level, 'low') = p_risk_level)
        and (
          trim(coalesce(p_query, '')) = ''
          or profile.name ilike '%' || trim(p_query) || '%'
          or coalesce(profile.department, '') ilike '%' || trim(p_query) || '%'
        )
        and (trim(coalesce(p_department, '')) = '' or coalesce(profile.department, '') = p_department)
    )
    select
      candidates.id, candidates.name, candidates.department,
      candidates.completed_trade_count, candidates.review_count,
      candidates.average_rating, candidates.low_rating_count,
      candidates.resolved_report_count, candidates.serious_report_count,
      candidates.risk_score, candidates.risk_level,
      candidates.seller_badge_eligible, candidates.buyer_badge_eligible,
      candidates.seller_badge_status, candidates.buyer_badge_status,
      candidates.review_status, candidates.review_updated_at,
      candidates.computed_at,
      case when p_cursor_risk_rank is null then (select count(*) from candidates) else null end
    from candidates
    where p_cursor_risk_rank is null
      or p_cursor_score is null
      or p_cursor_computed_at is null
      or p_cursor_id is null
      or candidates.risk_rank > p_cursor_risk_rank
      or (candidates.risk_rank = p_cursor_risk_rank and candidates.risk_score < p_cursor_score)
      or (candidates.risk_rank = p_cursor_risk_rank and candidates.risk_score = p_cursor_score
        and candidates.computed_at < p_cursor_computed_at)
      or (candidates.risk_rank = p_cursor_risk_rank and candidates.risk_score = p_cursor_score
        and candidates.computed_at = p_cursor_computed_at and candidates.id > p_cursor_id)
    order by candidates.risk_rank asc, candidates.risk_score desc,
      candidates.computed_at desc, candidates.id asc
    limit least(greatest(coalesce(p_limit, 20), 1), 51);
end;
$$;

revoke all on function public.list_risk_profiles_for_moderation(
  text, text, text, text, text, integer, integer, integer, timestamptz, uuid
) from public, anon;
grant execute on function public.list_risk_profiles_for_moderation(
  text, text, text, text, text, integer, integer, integer, timestamptz, uuid
) to authenticated;
