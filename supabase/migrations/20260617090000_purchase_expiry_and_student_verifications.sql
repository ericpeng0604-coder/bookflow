-- Extend pending purchase request expiry to 7 days and add free/manual student ID review support.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-verifications',
  'student-verifications',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  ocr_text text not null default '',
  quality_flags jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_verifications enable row level security;

create index if not exists student_verifications_status_created_idx
  on public.student_verifications (status, created_at desc);
create index if not exists student_verifications_user_created_idx
  on public.student_verifications (user_id, created_at desc);

revoke all on public.student_verifications from public, anon;
grant select on public.student_verifications to authenticated;

drop policy if exists "Users can read own student verifications" on public.student_verifications;
drop policy if exists "Moderators can read student verifications" on public.student_verifications;
create policy "Users can read own student verifications"
  on public.student_verifications for select to authenticated
  using (user_id = auth.uid());
create policy "Moderators can read student verifications"
  on public.student_verifications for select to authenticated
  using (public.is_moderator());

drop policy if exists "Users upload own student verification images" on storage.objects;
drop policy if exists "Users read own student verification images" on storage.objects;
drop policy if exists "Moderators read student verification images" on storage.objects;
create policy "Users upload own student verification images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user(auth.uid())
  );
create policy "Users read own student verification images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Moderators read student verification images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-verifications'
    and public.is_moderator()
  );

create or replace function public.submit_student_verification(
  image_path text,
  ocr_text text,
  quality_flags jsonb
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
  if image_path is null or split_part(image_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid student verification image path';
  end if;

  insert into public.student_verifications (
    user_id, image_path, ocr_text, quality_flags
  ) values (
    auth.uid(),
    image_path,
    left(coalesce(ocr_text, ''), 4000),
    coalesce(quality_flags, '{}'::jsonb)
  )
  returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.list_student_verifications_for_review()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
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
    profiles.name as user_name,
    profiles.email as user_email,
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

create or replace function public.review_student_verification(
  target_id uuid,
  decision text,
  note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid student verification decision';
  end if;

  update public.student_verifications
  set status = decision,
      review_note = coalesce(note, ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = target_id
    and status = 'pending';

  if not found then
    raise exception 'Pending student verification required';
  end if;
end;
$$;

revoke execute on function public.submit_student_verification(text, text, jsonb) from public, anon;
revoke execute on function public.list_student_verifications_for_review() from public, anon;
revoke execute on function public.review_student_verification(uuid, text, text) from public, anon;
grant execute on function public.submit_student_verification(text, text, jsonb) to authenticated;
grant execute on function public.list_student_verifications_for_review() to authenticated;
grant execute on function public.review_student_verification(uuid, text, text) to authenticated;

create or replace function public.process_trade_deadlines(reference_time timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare item record; reminded int := 0; expired int := 0; released int := 0; completed int := 0;
begin
  for item in select * from public.purchase_requests
    where status = 'pending' and created_at <= reference_time - interval '24 hours'
      and created_at > reference_time - interval '7 days' and reminded_at is null
  loop
    update public.purchase_requests set reminded_at = reference_time where id = item.id;
    insert into public.notifications (
      recipient_id, type, book_id, request_id, title, message, dedupe_key
    )
    select b.seller_id, 'order_reminder', b.id, item.id, '購買請求等待處理',
           '《' || b.title || '》有購買請求已等待超過 24 小時',
           'order-reminder-24:' || item.id::text
    from public.books b where b.id = item.book_id
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.order_events (request_id, event_type, dedupe_key)
    values (item.id, 'seller_reminded', 'order-reminder-24:' || item.id::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    reminded := reminded + 1;
  end loop;

  for item in select * from public.purchase_requests
    where status = 'pending' and created_at <= reference_time - interval '7 days'
  loop
    update public.purchase_requests set status = 'expired', updated_at = reference_time where id = item.id;
    insert into public.notifications (
      recipient_id, type, book_id, request_id, title, message, dedupe_key
    ) values (
      item.buyer_id, 'order_expired', item.book_id, item.id, '購買請求已失效',
      '賣家在 7 天內未處理，此次購買請求已自動失效，課本仍會保留在原刊登狀態',
      'order-expired-7d:' || item.id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.order_events (request_id, event_type, dedupe_key)
    values (item.id, 'expired', 'order-expired-7d:' || item.id::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    expired := expired + 1;
  end loop;

  for item in select * from public.purchase_requests
    where status = 'reserved' and reservation_expires_at <= reference_time
  loop
    update public.purchase_requests
    set status = 'expired', updated_at = reference_time, cancellation_reason = 'reservation_timeout'
    where id = item.id;
    update public.books set status = 'available', updated_at = reference_time where id = item.book_id;
    update public.purchase_requests set status = 'pending', updated_at = reference_time
    where book_id = item.book_id and status = 'waitlisted';
    insert into public.order_events (request_id, event_type, dedupe_key)
    values (item.id, 'reservation_expired', 'reservation-expired:' || item.id::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.notifications (
      recipient_id, type, book_id, request_id, title, message, dedupe_key
    ) values (
      item.buyer_id, 'reservation_cancelled', item.book_id, item.id,
      '7 天保留期限已到', '保留期限內未完成面交，課本已恢復販售',
      'reservation-expired-notice:' || item.id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
    released := released + 1;
  end loop;

  for item in select * from public.purchase_requests
    where status = 'awaiting_confirmation'
      and seller_handoff_at <= reference_time - interval '48 hours'
  loop
    perform public.finish_trade(item.id, null, true);
    completed := completed + 1;
  end loop;

  return jsonb_build_object('reminded', reminded, 'expired', expired, 'released', released, 'completed', completed);
end;
$$;

revoke execute on function public.process_trade_deadlines(timestamptz) from public, anon, authenticated;
grant execute on function public.process_trade_deadlines(timestamptz) to service_role;
