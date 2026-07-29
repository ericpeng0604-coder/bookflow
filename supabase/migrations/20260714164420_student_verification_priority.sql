-- Add OCR-derived student identity metadata and rank active verified sellers in
-- the public marketplace without exposing student ID data.

alter table public.student_verifications
  add column if not exists program_type text,
  add column if not exists admission_year smallint,
  add column if not exists department_code text,
  add column if not exists class_code text;

alter table public.student_verifications
  drop constraint if exists student_verifications_program_type_check,
  drop constraint if exists student_verifications_admission_year_check,
  drop constraint if exists student_verifications_department_code_check,
  drop constraint if exists student_verifications_class_code_check;

alter table public.student_verifications
  add constraint student_verifications_program_type_check
    check (program_type is null or program_type in ('two_year', 'four_year')),
  add constraint student_verifications_admission_year_check
    check (admission_year is null or admission_year between 1 and 199),
  add constraint student_verifications_department_code_check
    check (department_code is null or department_code ~ '^[0-9]{2}$'),
  add constraint student_verifications_class_code_check
    check (class_code is null or class_code ~ '^[0-9]$');

create index if not exists student_verifications_approved_year_idx
  on public.student_verifications (user_id, admission_year)
  where status = 'approved';

drop function if exists public.list_student_verifications_for_review();
create function public.list_student_verifications_for_review()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  image_path text,
  ocr_text text,
  quality_flags jsonb,
  program_type text,
  admission_year smallint,
  department_code text,
  class_code text,
  status text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;

  return query
  select
    verification.id,
    verification.user_id,
    profiles.name,
    verification.image_path,
    verification.ocr_text,
    verification.quality_flags,
    verification.program_type,
    verification.admission_year,
    verification.department_code,
    verification.class_code,
    verification.status,
    verification.review_note,
    verification.reviewed_by,
    verification.reviewed_at,
    verification.created_at
  from public.student_verifications verification
  join public.profiles profiles on profiles.id = verification.user_id
  where verification.status = 'pending'
  order by verification.created_at asc;
end;
$$;

drop function if exists public.submit_student_verification(text, text, jsonb);
drop function if exists public.submit_student_verification(text, text, jsonb, text);
create function public.submit_student_verification(
  image_path text,
  ocr_text text,
  quality_flags jsonb,
  student_number text
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  created_id uuid;
  taiwan_year smallint;
  parsed_admission_year smallint;
  parsed_program_type text;
  parsed_department_code text;
  parsed_class_code text;
  normalized_ocr text;
begin
  if auth.uid() is null or not public.is_active_user(auth.uid()) then
    raise exception 'Active account required';
  end if;
  if image_path is null or split_part(image_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid student verification image path';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'student-verifications' and name = image_path
  ) then
    raise exception 'Student verification image is missing';
  end if;
  if student_number is null or student_number !~ '^[34][0-9]{7}$' then
    raise exception 'A valid OCR student ID is required';
  end if;
  normalized_ocr := regexp_replace(
    translate(coalesce(ocr_text, ''), '０１２３４５６７８９', '0123456789'),
    '[^0-9]', '', 'g'
  );
  if position(student_number in normalized_ocr) = 0 then
    raise exception 'OCR text does not contain the submitted student ID';
  end if;

  taiwan_year := extract(year from timezone('Asia/Taipei', now()))::smallint - 1911;
  parsed_admission_year := 100 + substring(student_number from 2 for 2)::smallint;
  if parsed_admission_year < taiwan_year - 4 or parsed_admission_year > taiwan_year then
    raise exception 'Student ID is outside the current five-year window';
  end if;
  parsed_program_type := case when left(student_number, 1) = '4' then 'four_year' else 'two_year' end;
  parsed_department_code := substring(student_number from 4 for 2);
  parsed_class_code := substring(student_number from 6 for 1);

  if exists (
    select 1 from public.student_verifications
    where user_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'A pending student verification already exists';
  end if;
  if (
    select count(*) from public.student_verifications
    where user_id = auth.uid() and created_at > now() - interval '1 day'
  ) >= 2 then
    raise exception 'Daily student verification limit reached';
  end if;

  insert into public.student_verifications (
    user_id, image_path, ocr_text, quality_flags,
    program_type, admission_year, department_code, class_code, consented_at
  ) values (
    auth.uid(), image_path, left(coalesce(ocr_text, ''), 4000),
    coalesce(quality_flags, '{}'::jsonb), parsed_program_type,
    parsed_admission_year, parsed_department_code, parsed_class_code, now()
  )
  returning id into created_id;

  insert into public.student_verification_audit_logs (
    verification_id, actor_id, action
  ) values (created_id, auth.uid(), 'submitted');

  return created_id;
end;
$$;

drop function if exists public.get_public_student_verification_status(uuid[]);
create function public.get_public_student_verification_status(target_user_ids uuid[])
returns table (user_id uuid, seller_verified boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- This is an intentionally narrow public projection: it exposes only a
  -- boolean and must bypass private student_verifications RLS for catalog UI.
  select
    requested_user_id,
    exists (
      select 1
      from public.student_verifications verification
      where verification.user_id = requested_user_id
        and verification.status = 'approved'
        and verification.admission_year between
          (extract(year from timezone('Asia/Taipei', now()))::int - 1911 - 4)
          and (extract(year from timezone('Asia/Taipei', now()))::int - 1911)
    )
  from unnest(coalesce(target_user_ids, '{}'::uuid[])) as requested_user_id;
$$;

revoke all on function public.list_student_verifications_for_review() from public, anon;
revoke all on function public.submit_student_verification(text, text, jsonb, text) from public, anon;
revoke all on function public.get_public_student_verification_status(uuid[]) from public;
grant execute on function public.list_student_verifications_for_review() to authenticated;
grant execute on function public.submit_student_verification(text, text, jsonb, text) to authenticated;
grant execute on function public.get_public_student_verification_status(uuid[]) to anon, authenticated;

drop function if exists public.list_books_page(int, timestamptz, uuid, text, text, text, int, text);
drop function if exists public.list_books_page(int, timestamptz, uuid, text, text, text, int, text, int);
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
  -- This public RPC returns only already-public listing fields plus a boolean.
  -- Keep the fixed search_path and explicit return list to avoid exposing
  -- private verification columns while allowing the priority lookup to see
  -- approved records protected by student_verifications RLS.
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
    catalog.id,
    catalog.seller_id,
    catalog.verified,
    catalog.listing_type,
    catalog.item_category,
    catalog.title,
    catalog.author,
    catalog.department,
    catalog.course,
    catalog.teacher,
    catalog.edition,
    catalog.publisher,
    catalog.condition,
    catalog.price,
    catalog.image_url,
    catalog.meetup,
    catalog.description,
    catalog.status,
    catalog.review_status,
    catalog.review_note,
    catalog.education_level,
    catalog.grade,
    catalog.semester,
    catalog.subject,
    catalog.volume,
    catalog.curriculum,
    catalog.book_type,
    catalog.isbn13,
    catalog.approval_number,
    catalog.moderation_visibility,
    catalog.lifecycle_state,
    catalog.listing_confirmed_at,
    catalog.archived_at,
    catalog.archive_reason,
    catalog.created_at,
    catalog.updated_at
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

revoke execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text, int, boolean) from public;
grant execute on function public.list_books_page(int, timestamptz, uuid, text, text, text, int, text, int, boolean) to anon, authenticated;

create or replace function public.cleanup_sensitive_verification_data(
  reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count integer;
begin
  update public.student_verifications
  set image_path = '',
      ocr_text = '',
      quality_flags = '{}'::jsonb,
      sensitive_data_deleted_at = coalesce(sensitive_data_deleted_at, reference_time),
      updated_at = reference_time
  where status = 'approved'
    and sensitive_data_deleted_at is null
    and updated_at < reference_time - interval '30 days';

  delete from public.student_verifications
  where status in ('rejected', 'withdrawn')
    and updated_at < reference_time - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
