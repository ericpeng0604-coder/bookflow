-- Harden listing data, API rate limits, AI quota reservations, student-ID
-- retention, and notification privacy. This migration is expand/contract and
-- remains compatible with the previously deployed application.

alter table public.books
  add column if not exists education_level text not null default '',
  add column if not exists grade text not null default '',
  add column if not exists semester text not null default '',
  add column if not exists subject text not null default '',
  add column if not exists volume text not null default '',
  add column if not exists curriculum text not null default '',
  add column if not exists book_type text not null default '',
  add column if not exists isbn13 text not null default '',
  add column if not exists approval_number text not null default '';

create index if not exists books_textbook_metadata_idx
  on public.books (education_level, grade, semester, subject);
create index if not exists books_isbn13_idx
  on public.books (isbn13)
  where isbn13 <> '';

alter table public.books
  drop constraint if exists books_title_length_check,
  drop constraint if exists books_author_length_check,
  drop constraint if exists books_edition_length_check,
  drop constraint if exists books_publisher_length_check,
  drop constraint if exists books_course_length_check,
  drop constraint if exists books_teacher_length_check,
  drop constraint if exists books_meetup_length_check,
  drop constraint if exists books_description_length_check,
  drop constraint if exists books_price_upper_check,
  drop constraint if exists books_education_level_check,
  drop constraint if exists books_grade_length_check,
  drop constraint if exists books_semester_check,
  drop constraint if exists books_subject_length_check,
  drop constraint if exists books_volume_length_check,
  drop constraint if exists books_curriculum_length_check,
  drop constraint if exists books_book_type_check,
  drop constraint if exists books_isbn13_check,
  drop constraint if exists books_approval_number_length_check;

alter table public.books
  add constraint books_title_length_check
    check (char_length(btrim(title)) between 1 and 160) not valid,
  add constraint books_author_length_check
    check (char_length(author) <= 160) not valid,
  add constraint books_edition_length_check
    check (char_length(edition) <= 120) not valid,
  add constraint books_publisher_length_check
    check (char_length(publisher) <= 120) not valid,
  add constraint books_course_length_check
    check (char_length(course) <= 120) not valid,
  add constraint books_teacher_length_check
    check (char_length(teacher) <= 80) not valid,
  add constraint books_meetup_length_check
    check (char_length(btrim(meetup)) between 1 and 160) not valid,
  add constraint books_description_length_check
    check (char_length(btrim(description)) between 1 and 2000) not valid,
  add constraint books_price_upper_check
    check (price between 0 and 1000000) not valid,
  add constraint books_education_level_check
    check (
      education_level in (
        '', 'elementary', 'junior_high', 'senior_high',
        'vocational_high', 'university'
      )
    ) not valid,
  add constraint books_grade_length_check
    check (char_length(grade) <= 20) not valid,
  add constraint books_semester_check
    check (semester in ('', 'first', 'second')) not valid,
  add constraint books_subject_length_check
    check (char_length(subject) <= 80) not valid,
  add constraint books_volume_length_check
    check (char_length(volume) <= 40) not valid,
  add constraint books_curriculum_length_check
    check (char_length(curriculum) <= 40) not valid,
  add constraint books_book_type_check
    check (
      book_type in (
        '', 'textbook', 'workbook', 'teacher_guide',
        'reference', 'assessment', 'other'
      )
    ) not valid,
  add constraint books_isbn13_check
    check (isbn13 = '' or isbn13 ~ '^[0-9]{13}$') not valid,
  add constraint books_approval_number_length_check
    check (char_length(approval_number) <= 100) not valid;

-- Keep seller updates on an explicit allowlist. The publisher and marketplace
-- fields were introduced after the original column grant and must be included.
revoke update on table public.books from authenticated;
grant update (
  listing_type,
  item_category,
  title,
  author,
  department,
  course,
  teacher,
  edition,
  publisher,
  education_level,
  grade,
  semester,
  subject,
  volume,
  curriculum,
  book_type,
  isbn13,
  approval_number,
  condition,
  price,
  image_url,
  meetup,
  description,
  updated_at
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
    new.listing_type,
    new.item_category,
    new.title,
    new.author,
    new.department,
    new.course,
    new.teacher,
    new.edition,
    new.publisher,
    new.education_level,
    new.grade,
    new.semester,
    new.subject,
    new.volume,
    new.curriculum,
    new.book_type,
    new.isbn13,
    new.approval_number,
    new.condition,
    new.price,
    new.image_url,
    new.meetup,
    new.description
  ) is distinct from (
    old.listing_type,
    old.item_category,
    old.title,
    old.author,
    old.department,
    old.course,
    old.teacher,
    old.edition,
    old.publisher,
    old.education_level,
    old.grade,
    old.semester,
    old.subject,
    old.volume,
    old.curriculum,
    old.book_type,
    old.isbn13,
    old.approval_number,
    old.condition,
    old.price,
    old.image_url,
    old.meetup,
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

revoke execute on function public.enforce_book_review()
  from public, anon, authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'book-images',
  'book-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  bucket_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, bucket_started_at)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;

create table if not exists public.api_abuse_events (
  scope text not null,
  key_hash text not null,
  bucket_started_at timestamptz not null,
  blocked_count integer not null default 1 check (blocked_count >= 1),
  last_blocked_at timestamptz not null default now(),
  primary key (scope, key_hash, bucket_started_at)
);

alter table public.api_abuse_events enable row level security;
revoke all on public.api_abuse_events from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  rate_scope text,
  rate_key_hash text,
  request_limit integer,
  window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket_start timestamptz;
  next_count integer;
begin
  if char_length(btrim(coalesce(rate_scope, ''))) not between 1 and 80
    or char_length(btrim(coalesce(rate_key_hash, ''))) not between 16 and 128
    or request_limit not between 1 and 10000
    or window_seconds not between 10 and 86400 then
    raise exception 'Invalid rate-limit request';
  end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from now()) / window_seconds) * window_seconds
  );

  insert into public.api_rate_limits (
    scope, key_hash, bucket_started_at, request_count
  ) values (
    btrim(rate_scope), btrim(rate_key_hash), bucket_start, 1
  )
  on conflict (scope, key_hash, bucket_started_at)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = now()
  where public.api_rate_limits.request_count < request_limit
  returning request_count into next_count;

  if next_count is null then
    insert into public.api_abuse_events (
      scope, key_hash, bucket_started_at, blocked_count, last_blocked_at
    ) values (
      btrim(rate_scope), btrim(rate_key_hash), bucket_start, 1, now()
    )
    on conflict (scope, key_hash, bucket_started_at)
    do update set
      blocked_count = public.api_abuse_events.blocked_count + 1,
      last_blocked_at = now();
  end if;

  return query select
    next_count is not null,
    greatest(request_limit - coalesce(next_count, request_limit), 0),
    bucket_start + make_interval(secs => window_seconds);
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

create table if not exists public.book_ocr_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  idempotency_key text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  released_at timestamptz,
  unique (user_id, usage_date, idempotency_key)
);

create index if not exists book_ocr_quota_reservations_expiry_idx
  on public.book_ocr_quota_reservations (expires_at)
  where status = 'reserved';

alter table public.book_ocr_quota_reservations enable row level security;
revoke all on public.book_ocr_quota_reservations from public, anon, authenticated;

create or replace function public.reserve_book_ocr_quota(
  target_user_id uuid,
  request_key text,
  daily_limit integer default 20
)
returns table (
  allowed boolean,
  remaining integer,
  reservation_id uuid,
  reservation_state text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  today_utc date := (timezone('UTC', now()))::date;
  active_count integer;
  existing public.book_ocr_quota_reservations;
  created_id uuid;
begin
  if target_user_id is null
    or char_length(btrim(coalesce(request_key, ''))) not between 16 and 100
    or daily_limit not between 1 and 100 then
    raise exception 'Invalid book OCR quota reservation';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_user_id::text || ':' || today_utc::text));

  update public.book_ocr_quota_reservations
  set status = 'released', released_at = now()
  where user_id = target_user_id
    and usage_date = today_utc
    and status = 'reserved'
    and expires_at <= now();

  select * into existing
  from public.book_ocr_quota_reservations
  where user_id = target_user_id
    and usage_date = today_utc
    and idempotency_key = btrim(request_key);

  if existing.id is not null then
    select count(*) into active_count
    from public.book_ocr_quota_reservations
    where user_id = target_user_id
      and usage_date = today_utc
      and status in ('reserved', 'completed');

    return query select
      false,
      greatest(daily_limit - active_count, 0),
      existing.id,
      existing.status;
    return;
  end if;

  select count(*) into active_count
  from public.book_ocr_quota_reservations
  where user_id = target_user_id
    and usage_date = today_utc
    and status in ('reserved', 'completed');

  if active_count >= daily_limit then
    return query select false, 0, null::uuid, 'exhausted'::text;
    return;
  end if;

  insert into public.book_ocr_quota_reservations (
    user_id, usage_date, idempotency_key, expires_at
  ) values (
    target_user_id, today_utc, btrim(request_key), now() + interval '2 minutes'
  )
  returning id into created_id;

  return query select
    true,
    greatest(daily_limit - active_count - 1, 0),
    created_id,
    'reserved'::text;
end;
$$;

create or replace function public.finalize_book_ocr_quota(
  target_reservation_id uuid,
  succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.book_ocr_quota_reservations;
begin
  select * into target
  from public.book_ocr_quota_reservations
  where id = target_reservation_id
  for update;

  if target.id is null or target.status <> 'reserved' then
    return;
  end if;

  if succeeded then
    update public.book_ocr_quota_reservations
    set status = 'completed', completed_at = now()
    where id = target.id;

    insert into public.book_ocr_daily_usage (
      user_id, usage_date, request_count, updated_at
    ) values (
      target.user_id, target.usage_date, 1, now()
    )
    on conflict (user_id, usage_date)
    do update set
      request_count = public.book_ocr_daily_usage.request_count + 1,
      updated_at = now();
  else
    update public.book_ocr_quota_reservations
    set status = 'released', released_at = now()
    where id = target.id;
  end if;
end;
$$;

revoke execute on function public.reserve_book_ocr_quota(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.finalize_book_ocr_quota(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_book_ocr_quota(uuid, text, integer)
  to service_role;
grant execute on function public.finalize_book_ocr_quota(uuid, boolean)
  to service_role;

alter table public.student_verifications
  drop constraint if exists student_verifications_status_check;
alter table public.student_verifications
  add constraint student_verifications_status_check
    check (status in ('pending', 'approved', 'rejected', 'withdrawn'));
alter table public.student_verifications
  add column if not exists consented_at timestamptz,
  add column if not exists sensitive_data_deleted_at timestamptz;

update public.student_verifications
set consented_at = coalesce(consented_at, created_at)
where consented_at is null;

create unique index if not exists student_verifications_one_pending_per_user
  on public.student_verifications (user_id)
  where status = 'pending';

create table if not exists public.student_verification_audit_logs (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (
    action in ('submitted', 'approved', 'rejected', 'withdrawn', 'sensitive_data_deleted')
  ),
  created_at timestamptz not null default now()
);

alter table public.student_verification_audit_logs enable row level security;
revoke all on public.student_verification_audit_logs from public, anon, authenticated;
grant select on public.student_verification_audit_logs to authenticated;

drop policy if exists "Moderators can read verification audit logs"
  on public.student_verification_audit_logs;
create policy "Moderators can read verification audit logs"
  on public.student_verification_audit_logs for select to authenticated
  using (public.is_moderator());

drop function if exists public.list_student_verifications_for_review();
create function public.list_student_verifications_for_review()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  image_path text,
  ocr_text text,
  quality_flags jsonb,
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

create or replace function public.submit_student_verification(
  image_path text,
  ocr_text text,
  quality_flags jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare created_id uuid;
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
    user_id, image_path, ocr_text, quality_flags, consented_at
  ) values (
    auth.uid(), image_path, left(coalesce(ocr_text, ''), 4000),
    coalesce(quality_flags, '{}'::jsonb), now()
  )
  returning id into created_id;

  insert into public.student_verification_audit_logs (
    verification_id, actor_id, action
  ) values (created_id, auth.uid(), 'submitted');

  return created_id;
end;
$$;

create or replace function public.review_student_verification(
  target_id uuid,
  decision text,
  note text default ''
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare target public.student_verifications;
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid student verification decision';
  end if;

  select * into target
  from public.student_verifications
  where id = target_id and status = 'pending'
  for update;
  if target.id is null then
    raise exception 'Pending student verification required';
  end if;

  delete from storage.objects
  where bucket_id = 'student-verifications' and name = target.image_path;

  update public.student_verifications
  set status = decision,
      review_note = left(coalesce(note, ''), 1000),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      image_path = '',
      ocr_text = '',
      quality_flags = '{}'::jsonb,
      sensitive_data_deleted_at = now(),
      updated_at = now()
  where id = target.id;

  insert into public.student_verification_audit_logs (
    verification_id, actor_id, action
  ) values (
    target.id, auth.uid(), decision
  );
end;
$$;

create or replace function public.withdraw_student_verification(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare target public.student_verifications;
begin
  select * into target
  from public.student_verifications
  where id = target_id and user_id = auth.uid() and status = 'pending'
  for update;
  if target.id is null then
    raise exception 'Pending student verification required';
  end if;

  delete from storage.objects
  where bucket_id = 'student-verifications' and name = target.image_path;

  update public.student_verifications
  set status = 'withdrawn',
      image_path = '',
      ocr_text = '',
      quality_flags = '{}'::jsonb,
      sensitive_data_deleted_at = now(),
      updated_at = now()
  where id = target.id;

  insert into public.student_verification_audit_logs (
    verification_id, actor_id, action
  ) values (target.id, auth.uid(), 'withdrawn');
end;
$$;

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
  delete from public.student_verifications
  where status in ('approved', 'rejected', 'withdrawn')
    and updated_at < reference_time - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.list_student_verifications_for_review()
  from public, anon;
revoke execute on function public.submit_student_verification(text, text, jsonb)
  from public, anon;
revoke execute on function public.review_student_verification(uuid, text, text)
  from public, anon;
revoke execute on function public.withdraw_student_verification(uuid)
  from public, anon;
revoke execute on function public.cleanup_sensitive_verification_data(timestamptz)
  from public, anon, authenticated;
grant execute on function public.list_student_verifications_for_review()
  to authenticated;
grant execute on function public.submit_student_verification(text, text, jsonb)
  to authenticated;
grant execute on function public.review_student_verification(uuid, text, text)
  to authenticated;
grant execute on function public.withdraw_student_verification(uuid)
  to authenticated;
grant execute on function public.cleanup_sensitive_verification_data(timestamptz)
  to service_role;

alter table public.notifications
  add column if not exists email_abandoned_at timestamptz,
  add column if not exists push_abandoned_at timestamptz;

-- Notification previews are visible on lock screens and in email. Chat content
-- must remain inside the authenticated conversation.
create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target public.conversations; recipient uuid; target_book public.books;
begin
  select * into target from public.conversations where id = new.conversation_id;
  select * into target_book from public.books where id = target.book_id;
  recipient := case when new.sender_id = target.buyer_id then target.seller_id else target.buyer_id end;
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, conversation_id, title, message
  ) values (
    recipient, new.sender_id, 'trade_message', target.book_id, target.id,
    '收到新的聊聊訊息',
    '你有一則關於《' || target_book.title || '》的新訊息，請登入虎科書流查看'
  );
  return new;
end;
$$;

-- Keep short-lived operational rows bounded.
create or replace function public.cleanup_operational_data(
  reference_time timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare rate_rows integer; quota_rows integer;
begin
  delete from public.api_rate_limits
  where bucket_started_at < reference_time - interval '2 days';
  get diagnostics rate_rows = row_count;

  delete from public.book_ocr_quota_reservations
  where usage_date < (timezone('UTC', reference_time))::date - 30;
  get diagnostics quota_rows = row_count;

  return jsonb_build_object(
    'rate_limit_rows', rate_rows,
    'quota_reservation_rows', quota_rows
  );
end;
$$;

revoke execute on function public.cleanup_operational_data(timestamptz)
  from public, anon, authenticated;
grant execute on function public.cleanup_operational_data(timestamptz)
  to service_role;

-- Return the structured Taiwan-textbook metadata from catalog RPCs. Search is
-- token based so phrases such as "國一 翰林 數學 上" can match fields that are
-- stored separately.
drop function if exists public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text
);
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
    b.education_level,
    b.grade,
    b.semester,
    b.subject,
    b.volume,
    b.curriculum,
    b.book_type,
    b.isbn13,
    b.approval_number,
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
      or not exists (
        select 1
        from regexp_split_to_table(lower(btrim(p_query)), '\s+')
          as search_token(token)
        where token <> ''
          and lower(concat_ws(
            ' ',
            b.title,
            b.author,
            b.publisher,
            b.course,
            b.teacher,
            b.description,
            b.item_category,
            case b.education_level
              when 'elementary' then '國小 國民小學'
              when 'junior_high' then '國中 國民中學'
              when 'senior_high' then '高中 普通型高級中等學校'
              when 'vocational_high' then '高職 技高 技術型高級中等學校'
              when 'university' then '大學 大專院校'
              else ''
            end,
            case when b.grade <> '' then b.grade || '年級' else '' end,
            case b.semester
              when 'first' then '上學期 上冊'
              when 'second' then '下學期 下冊'
              else ''
            end,
            b.subject,
            b.volume,
            b.curriculum,
            case b.book_type
              when 'textbook' then '課本 教科書'
              when 'workbook' then '習作'
              when 'teacher_guide' then '教師手冊 教師用書'
              when 'reference' then '自修 講義 參考書'
              when 'assessment' then '評量 題庫 測驗卷'
              else ''
            end,
            b.isbn13,
            b.approval_number
          )) not ilike
            '%' || replace(
              replace(replace(token, '\', '\\'), '%', '\%'),
              '_', '\_'
            ) || '%' escape '\'
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
    b.education_level,
    b.grade,
    b.semester,
    b.subject,
    b.volume,
    b.curriculum,
    b.book_type,
    b.isbn13,
    b.approval_number,
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
      or not exists (
        select 1
        from regexp_split_to_table(lower(btrim(p_query)), '\s+')
          as search_token(token)
        where token <> ''
          and lower(concat_ws(
            ' ',
            b.title,
            b.author,
            b.publisher,
            b.course,
            b.teacher,
            b.description,
            b.item_category,
            case b.education_level
              when 'elementary' then '國小 國民小學'
              when 'junior_high' then '國中 國民中學'
              when 'senior_high' then '高中 普通型高級中等學校'
              when 'vocational_high' then '高職 技高 技術型高級中等學校'
              when 'university' then '大學 大專院校'
              else ''
            end,
            case when b.grade <> '' then b.grade || '年級' else '' end,
            case b.semester
              when 'first' then '上學期 上冊'
              when 'second' then '下學期 下冊'
              else ''
            end,
            b.subject,
            b.volume,
            b.curriculum,
            case b.book_type
              when 'textbook' then '課本 教科書'
              when 'workbook' then '習作'
              when 'teacher_guide' then '教師手冊 教師用書'
              when 'reference' then '自修 講義 參考書'
              when 'assessment' then '評量 題庫 測驗卷'
              else ''
            end,
            b.isbn13,
            b.approval_number
          )) not ilike
            '%' || replace(
              replace(replace(token, '\', '\\'), '%', '\%'),
              '_', '\_'
            ) || '%' escape '\'
      )
    );
$$;

revoke execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text
) from public;
revoke execute on function public.list_pending_reviews_page(
  int, timestamptz, uuid
) from public;
revoke execute on function public.count_books_filtered(
  text, text, text, int, text
) from public;
grant execute on function public.list_books_page(
  int, timestamptz, uuid, text, text, text, int, text
) to anon, authenticated;
grant execute on function public.list_pending_reviews_page(
  int, timestamptz, uuid
) to authenticated;
grant execute on function public.count_books_filtered(
  text, text, text, int, text
) to anon, authenticated;

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested', 'anonymized', 'completed')),
  requested_at timestamptz not null default now(),
  anonymized_at timestamptz,
  auth_deleted_at timestamptz,
  retention_reason text not null default
    'Minimum transaction, fraud-prevention, and moderation records are retained.'
);

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;

create or replace function public.anonymize_account_for_deletion(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if target_user_id is null or not exists (
    select 1 from public.profiles where id = target_user_id
  ) then
    raise exception 'Account not found';
  end if;

  insert into public.account_deletion_requests (
    user_id, status, requested_at
  ) values (
    target_user_id, 'requested', now()
  )
  on conflict (user_id) do update
  set requested_at = least(
    public.account_deletion_requests.requested_at,
    excluded.requested_at
  );

  update public.purchase_requests request
  set status = 'cancelled',
      cancelled_at = coalesce(request.cancelled_at, now()),
      cancellation_reason = 'account_deleted',
      updated_at = now()
  where request.status in (
      'pending', 'waitlisted', 'reserved', 'awaiting_confirmation'
    )
    and (
      request.buyer_id = target_user_id
      or exists (
        select 1 from public.books book
        where book.id = request.book_id
          and book.seller_id = target_user_id
      )
    );

  update public.conversations
  set status = 'closed',
      closed_reason = 'account_deleted',
      updated_at = now()
  where target_user_id in (buyer_id, seller_id)
    and status = 'active';

  delete from storage.objects
  where (bucket_id in ('book-images', 'student-verifications')
      and (storage.foldername(name))[1] = target_user_id::text)
    or (bucket_id = 'chat-images'
      and (storage.foldername(name))[2] = target_user_id::text);

  update public.trade_messages
  set body = '',
      image_paths = '{}'::text[],
      recalled_at = coalesce(recalled_at, now()),
      recalled_body = null
  where sender_id = target_user_id;

  delete from public.push_subscriptions where user_id = target_user_id;
  delete from public.favorites where user_id = target_user_id;
  delete from public.user_blocks
  where blocker_id = target_user_id or blocked_id = target_user_id;
  delete from public.conversation_user_preferences where user_id = target_user_id;
  delete from public.notifications where recipient_id = target_user_id;
  delete from public.student_verifications where user_id = target_user_id;
  delete from public.book_contact_preferences preference
  using public.books book
  where preference.book_id = book.id
    and book.seller_id = target_user_id;

  update public.books
  set lifecycle_state = 'withdrawn',
      moderation_visibility = 'hidden',
      image_url = '',
      description = '帳號已刪除',
      updated_at = now()
  where seller_id = target_user_id;

  update public.profiles
  set name = '已刪除使用者',
      email = 'deleted+' || replace(target_user_id::text, '-', '') || '@bookflow.invalid',
      department = '未設定',
      role = 'user',
      account_status = 'suspended',
      suspended_at = now(),
      suspended_by = null,
      suspension_reason = 'account_deleted'
  where id = target_user_id;

  update public.account_deletion_requests
  set status = 'anonymized',
      anonymized_at = coalesce(anonymized_at, now())
  where user_id = target_user_id;
end;
$$;

revoke execute on function public.anonymize_account_for_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.anonymize_account_for_deletion(uuid)
  to service_role;

create table if not exists public.textbook_ocr_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalog_version text not null,
  original_metadata jsonb not null,
  corrected_metadata jsonb not null,
  created_at timestamptz not null default now(),
  check (char_length(catalog_version) between 1 and 40),
  check (octet_length(original_metadata::text) <= 5000),
  check (octet_length(corrected_metadata::text) <= 5000)
);

create index if not exists textbook_ocr_feedback_created_idx
  on public.textbook_ocr_feedback (created_at desc);

alter table public.textbook_ocr_feedback enable row level security;
revoke all on public.textbook_ocr_feedback from public, anon, authenticated;

create or replace function public.record_textbook_ocr_feedback(
  original_metadata jsonb,
  corrected_metadata jsonb,
  catalog_version text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare created_id uuid;
begin
  if auth.uid() is null or not public.is_active_user(auth.uid()) then
    raise exception 'Active account required';
  end if;
  if jsonb_typeof(original_metadata) <> 'object'
    or jsonb_typeof(corrected_metadata) <> 'object'
    or octet_length(original_metadata::text) > 5000
    or octet_length(corrected_metadata::text) > 5000
    or char_length(btrim(coalesce(catalog_version, ''))) not between 1 and 40 then
    raise exception 'Invalid OCR feedback';
  end if;

  insert into public.textbook_ocr_feedback (
    user_id,
    catalog_version,
    original_metadata,
    corrected_metadata
  ) values (
    auth.uid(),
    btrim(catalog_version),
    jsonb_strip_nulls(original_metadata),
    jsonb_strip_nulls(corrected_metadata)
  )
  returning id into created_id;
  return created_id;
end;
$$;

revoke execute on function public.record_textbook_ocr_feedback(
  jsonb, jsonb, text
) from public, anon;
grant execute on function public.record_textbook_ocr_feedback(
  jsonb, jsonb, text
) to authenticated;

create table if not exists public.moderation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_audit_logs_created_idx
  on public.moderation_audit_logs (created_at desc);

alter table public.moderation_audit_logs enable row level security;
revoke all on public.moderation_audit_logs from public, anon, authenticated;
grant select on public.moderation_audit_logs to authenticated;

drop policy if exists "Moderators can read moderation audit logs"
  on public.moderation_audit_logs;
create policy "Moderators can read moderation audit logs"
  on public.moderation_audit_logs for select to authenticated
  using (public.is_moderator());

create or replace function public.audit_book_moderation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.review_status, new.moderation_visibility)
    is distinct from (old.review_status, old.moderation_visibility) then
    insert into public.moderation_audit_logs (
      actor_id, action, target_type, target_id, details
    ) values (
      auth.uid(),
      'book_moderation_changed',
      'book',
      new.id,
      jsonb_build_object(
        'review_status_before', old.review_status,
        'review_status_after', new.review_status,
        'visibility_before', old.moderation_visibility,
        'visibility_after', new.moderation_visibility
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_profile_permission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role, new.account_status)
    is distinct from (old.role, old.account_status) then
    insert into public.moderation_audit_logs (
      actor_id, action, target_type, target_id, details
    ) values (
      auth.uid(),
      'profile_permission_changed',
      'profile',
      new.id,
      jsonb_build_object(
        'role_before', old.role,
        'role_after', new.role,
        'account_status_before', old.account_status,
        'account_status_after', new.account_status
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_report_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.moderation_audit_logs (
      actor_id, action, target_type, target_id, details
    ) values (
      auth.uid(),
      'report_status_changed',
      'report',
      new.id,
      jsonb_build_object('status_before', old.status, 'status_after', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_book_moderation_change on public.books;
create trigger audit_book_moderation_change
after update on public.books
for each row execute function public.audit_book_moderation_change();

drop trigger if exists audit_profile_permission_change on public.profiles;
create trigger audit_profile_permission_change
after update on public.profiles
for each row execute function public.audit_profile_permission_change();

drop trigger if exists audit_report_resolution on public.reports;
create trigger audit_report_resolution
after update on public.reports
for each row execute function public.audit_report_resolution();

revoke execute on function public.audit_book_moderation_change()
  from public, anon, authenticated;
revoke execute on function public.audit_profile_permission_change()
  from public, anon, authenticated;
revoke execute on function public.audit_report_resolution()
  from public, anon, authenticated;

create or replace function public.cleanup_operational_data(
  reference_time timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  rate_rows integer;
  quota_rows integer;
  usage_rows integer;
  notification_rows integer;
  feedback_rows integer;
  report_rows integer;
  chat_report_rows integer;
  push_rows integer;
  auth_rows integer;
  ocr_feedback_rows integer;
  audit_rows integer;
  abuse_rows integer;
  orphan_chat_image_rows integer;
begin
  delete from public.api_rate_limits
  where bucket_started_at < reference_time - interval '2 days';
  get diagnostics rate_rows = row_count;

  delete from public.api_abuse_events
  where bucket_started_at < reference_time - interval '30 days';
  get diagnostics abuse_rows = row_count;

  delete from public.book_ocr_quota_reservations
  where usage_date < (timezone('UTC', reference_time))::date - 30;
  get diagnostics quota_rows = row_count;

  delete from public.book_ocr_daily_usage
  where usage_date < (timezone('UTC', reference_time))::date - 180;
  get diagnostics usage_rows = row_count;

  delete from public.notifications
  where created_at < reference_time - interval '180 days';
  get diagnostics notification_rows = row_count;

  delete from public.user_feedback
  where status = 'resolved'
    and coalesce(resolved_at, created_at) < reference_time - interval '180 days';
  get diagnostics feedback_rows = row_count;

  delete from public.reports
  where status in ('resolved', 'dismissed')
    and coalesce(resolved_at, created_at) < reference_time - interval '365 days';
  get diagnostics report_rows = row_count;

  delete from public.chat_reports
  where status in ('resolved', 'dismissed')
    and created_at < reference_time - interval '365 days';
  get diagnostics chat_report_rows = row_count;

  delete from public.push_subscriptions
  where (not enabled or failure_count >= 10)
    and updated_at < reference_time - interval '90 days';
  get diagnostics push_rows = row_count;

  delete from public.admin_login_verifications
  where verified_at < reference_time - interval '7 days';
  get diagnostics auth_rows = row_count;

  delete from public.textbook_ocr_feedback
  where created_at < reference_time - interval '180 days';
  get diagnostics ocr_feedback_rows = row_count;

  delete from public.moderation_audit_logs
  where created_at < reference_time - interval '730 days';
  get diagnostics audit_rows = row_count;

  delete from storage.objects object
  where object.bucket_id = 'chat-images'
    and object.created_at < reference_time - interval '30 days'
    and not exists (
      select 1
      from public.trade_messages message
      where object.name = any(message.image_paths)
    );
  get diagnostics orphan_chat_image_rows = row_count;

  return jsonb_build_object(
    'rate_limit_rows', rate_rows,
    'api_abuse_rows', abuse_rows,
    'quota_reservation_rows', quota_rows,
    'quota_usage_rows', usage_rows,
    'notification_rows', notification_rows,
    'feedback_rows', feedback_rows,
    'report_rows', report_rows,
    'chat_report_rows', chat_report_rows,
    'push_subscription_rows', push_rows,
    'admin_verification_rows', auth_rows,
    'ocr_feedback_rows', ocr_feedback_rows,
    'moderation_audit_rows', audit_rows,
    'orphan_chat_image_rows', orphan_chat_image_rows
  );
end;
$$;
