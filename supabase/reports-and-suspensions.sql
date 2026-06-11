-- Run after schema.sql, moderation.sql, and transactions-and-notifications.sql.
-- Idempotent migration for reports, hidden listings, account suspensions, and audit logs.

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspension_reason text not null default '';

alter table public.books
  add column if not exists moderation_visibility text not null default 'visible'
    check (moderation_visibility in ('visible', 'hidden'));

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('book', 'user')),
  target_id uuid not null,
  reason text not null check (
    reason in ('misleading', 'fraud', 'duplicate', 'harassment', 'no_show', 'other')
  ),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text not null default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists reports_one_pending_target_per_user
  on public.reports (reporter_id, target_type, target_id)
  where status = 'pending';
create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null check (
    action in (
      'report_dismissed',
      'report_resolved',
      'book_hidden',
      'book_restored',
      'user_suspended',
      'user_restored'
    )
  ),
  target_type text not null check (target_type in ('report', 'book', 'user')),
  target_id uuid not null,
  report_id uuid references public.reports(id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists admin_action_logs_created_idx
  on public.admin_action_logs (created_at desc);

alter table public.reports enable row level security;
alter table public.admin_action_logs enable row level security;

drop policy if exists "Reporters read their reports and moderators read all" on public.reports;
create policy "Reporters read their reports and moderators read all"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

revoke insert, update, delete on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;

drop policy if exists "Admins read action logs" on public.admin_action_logs;
create policy "Admins read action logs"
  on public.admin_action_logs for select to authenticated
  using (public.is_verified_admin());

revoke insert, update, delete on table public.admin_action_logs from anon, authenticated;
grant select on table public.admin_action_logs to authenticated;

create or replace function public.is_active_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id and account_status = 'active'
  );
$$;

revoke execute on function public.is_active_user(uuid) from public;
grant execute on function public.is_active_user(uuid) to anon, authenticated;

do $setup$
begin
  if to_regprocedure('public.is_verified_admin()') is null then
    execute $function$
      create function public.is_verified_admin()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from public.profiles
          where id = auth.uid()
            and role = 'admin'
            and account_status = 'active'
        );
      $body$
    $function$;
  end if;
end
$setup$;

revoke execute on function public.is_verified_admin() from public;
grant execute on function public.is_verified_admin() to anon, authenticated;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'moderator'
      and account_status = 'active'
  ) or public.is_verified_admin();
$$;

revoke execute on function public.is_moderator() from public;
grant execute on function public.is_moderator() to anon, authenticated;

create or replace function public.is_book_buyer(target_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.purchase_requests
    where book_id = target_book_id and buyer_id = auth.uid()
  );
$$;

revoke execute on function public.is_book_buyer(uuid) from public;
grant execute on function public.is_book_buyer(uuid) to authenticated;

drop policy if exists "Approved books are public and parties can review their records" on public.books;
drop policy if exists "Users can create pending listings" on public.books;
drop policy if exists "Sellers can update their own listings" on public.books;
drop policy if exists "Sellers and moderators can delete listings" on public.books;
drop policy if exists "Approved visible books are public and owners can review records" on public.books;
drop policy if exists "Active users can create pending listings" on public.books;
drop policy if exists "Active sellers can update their listings" on public.books;
drop policy if exists "Active sellers and moderators can delete listings" on public.books;

create policy "Approved visible books are public and owners can review records"
  on public.books for select
  using (
    (review_status = 'approved' and moderation_visibility = 'visible')
    or seller_id = auth.uid()
    or public.is_moderator()
    or public.is_book_buyer(books.id)
  );

create policy "Active users can create pending listings"
  on public.books for insert to authenticated
  with check (
    auth.uid() = seller_id
    and review_status = 'pending'
    and moderation_visibility = 'visible'
    and public.is_active_user()
  );

create policy "Active sellers can update their listings"
  on public.books for update to authenticated
  using (auth.uid() = seller_id and public.is_active_user())
  with check (
    auth.uid() = seller_id
    and moderation_visibility = 'visible'
    and public.is_active_user()
  );

create policy "Active sellers and moderators can delete listings"
  on public.books for delete to authenticated
  using (
    (auth.uid() = seller_id and public.is_active_user())
    or public.is_moderator()
  );

drop policy if exists "Buyers can create valid requests" on public.purchase_requests;
drop policy if exists "Buyers can cancel pending requests" on public.purchase_requests;
drop policy if exists "Active buyers can create valid requests" on public.purchase_requests;
drop policy if exists "Active buyers can cancel pending requests" on public.purchase_requests;

create policy "Active buyers can create valid requests"
  on public.purchase_requests for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and public.is_active_user()
    and exists (
      select 1
      from public.books
      where books.id = purchase_requests.book_id
        and books.seller_id <> auth.uid()
        and books.status = 'available'
        and books.review_status = 'approved'
        and books.moderation_visibility = 'visible'
        and public.is_active_user(books.seller_id)
    )
  );

create policy "Active buyers can cancel pending requests"
  on public.purchase_requests for update to authenticated
  using (auth.uid() = buyer_id and status = 'pending' and public.is_active_user())
  with check (auth.uid() = buyer_id and status = 'cancelled' and public.is_active_user());

drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Active users can update their own profile" on public.profiles;
create policy "Active users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id and public.is_active_user())
  with check (auth.uid() = id and public.is_active_user());

drop policy if exists "Users can upload book images" on storage.objects;
drop policy if exists "Users can update their book images" on storage.objects;
drop policy if exists "Users can delete their book images" on storage.objects;
drop policy if exists "Active users can upload book images" on storage.objects;
drop policy if exists "Active users can update their book images" on storage.objects;
drop policy if exists "Active users can delete their book images" on storage.objects;

create policy "Active users can upload book images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'book-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );
create policy "Active users can update their book images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'book-images'
    and owner_id = auth.uid()::text
    and public.is_active_user()
  );
create policy "Active users can delete their book images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'book-images'
    and owner_id = auth.uid()::text
    and public.is_active_user()
  );

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'request_created',
      'request_accepted',
      'request_rejected',
      'trade_completed',
      'book_approved',
      'book_rejected',
      'book_hidden',
      'account_suspended'
    )
  );

create or replace function public.get_public_profiles()
returns table (
  id uuid,
  name text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id, profiles.name, profiles.department
  from public.profiles
  where profiles.account_status = 'active'
    and exists (
      select 1
      from public.books
      where books.seller_id = profiles.id
        and books.review_status = 'approved'
        and books.moderation_visibility = 'visible'
    )
  order by profiles.name;
$$;

revoke execute on function public.get_public_profiles() from public;
grant execute on function public.get_public_profiles() to anon, authenticated;

drop function if exists public.list_profiles_for_admin();
create function public.list_profiles_for_admin()
returns table (
  id uuid,
  name text,
  email text,
  department text,
  role text,
  account_status text,
  suspended_at timestamptz,
  suspension_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_verified_admin() then
    raise exception 'Admin permission required';
  end if;

  return query
    select
      profiles.id,
      profiles.name,
      profiles.email,
      profiles.department,
      profiles.role,
      profiles.account_status,
      profiles.suspended_at,
      profiles.suspension_reason
    from public.profiles
    order by profiles.created_at;
end;
$$;

revoke execute on function public.list_profiles_for_admin() from public, anon;
grant execute on function public.list_profiles_for_admin() to authenticated;

create or replace function public.submit_report(
  report_target_type text,
  report_target_id uuid,
  report_reason text,
  report_details text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_report_id uuid;
  target_owner_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if report_target_type not in ('book', 'user') then
    raise exception 'Invalid report target';
  end if;
  if report_reason not in ('misleading', 'fraud', 'duplicate', 'harassment', 'no_show', 'other') then
    raise exception 'Invalid report reason';
  end if;
  if char_length(coalesce(report_details, '')) > 1000 then
    raise exception 'Report details are too long';
  end if;

  if report_target_type = 'book' then
    select seller_id into target_owner_id
    from public.books
    where id = report_target_id;
    if target_owner_id is null then
      raise exception 'Book not found';
    end if;
  else
    select id into target_owner_id
    from public.profiles
    where id = report_target_id;
    if target_owner_id is null then
      raise exception 'User not found';
    end if;
  end if;

  if target_owner_id = auth.uid() then
    raise exception 'You cannot report yourself';
  end if;

  insert into public.reports (
    reporter_id, target_type, target_id, reason, details
  ) values (
    auth.uid(), report_target_type, report_target_id, report_reason, trim(coalesce(report_details, ''))
  )
  returning id into created_report_id;

  return created_report_id;
exception
  when unique_violation then
    raise exception 'A pending report already exists for this target';
end;
$$;

revoke execute on function public.submit_report(text, uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

create or replace function public.list_reports_for_moderation()
returns table (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  target_type text,
  target_id uuid,
  target_name text,
  book_id uuid,
  book_title text,
  reason text,
  details text,
  status text,
  resolution_note text,
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
      reports.id,
      reports.reporter_id,
      reporter.name,
      reports.target_type,
      reports.target_id,
      case
        when reports.target_type = 'book' then coalesce(book.title, '已刪除商品')
        else coalesce(target_user.name, '已刪除使用者')
      end,
      case when reports.target_type = 'book' then book.id else null end,
      case when reports.target_type = 'book' then book.title else null end,
      reports.reason,
      reports.details,
      reports.status,
      reports.resolution_note,
      reports.created_at
    from public.reports
    join public.profiles reporter on reporter.id = reports.reporter_id
    left join public.books book
      on reports.target_type = 'book' and book.id = reports.target_id
    left join public.profiles target_user
      on reports.target_type = 'user' and target_user.id = reports.target_id
    order by
      case when reports.status = 'pending' then 0 else 1 end,
      reports.created_at desc;
end;
$$;

revoke execute on function public.list_reports_for_moderation() from public, anon;
grant execute on function public.list_reports_for_moderation() to authenticated;

create or replace function public.resolve_report(
  target_report_id uuid,
  resolution_action text,
  note text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_report public.reports;
  target_book public.books;
  affected_user_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;
  if resolution_action not in ('dismiss', 'resolve', 'hide_book', 'suspend_user') then
    raise exception 'Invalid resolution action';
  end if;

  select * into target_report
  from public.reports
  where id = target_report_id
  for update;

  if target_report.id is null or target_report.status <> 'pending' then
    raise exception 'Pending report required';
  end if;

  if resolution_action = 'hide_book' then
    if target_report.target_type <> 'book' then
      raise exception 'Book report required';
    end if;
    update public.books
    set moderation_visibility = 'hidden', updated_at = now()
    where id = target_report.target_id
    returning * into target_book;
    if target_book.id is null then
      raise exception 'Book not found';
    end if;

    insert into public.notifications (
      recipient_id, actor_id, type, book_id, title, message
    ) values (
      target_book.seller_id,
      auth.uid(),
      'book_hidden',
      target_book.id,
      '刊登已被隱藏',
      '《' || target_book.title || '》已由管理員隱藏：' || coalesce(nullif(trim(note), ''), '違反平台規範')
    );
    insert into public.admin_action_logs (
      admin_id, action, target_type, target_id, report_id, reason
    ) values (
      auth.uid(), 'book_hidden', 'book', target_book.id, target_report.id, coalesce(note, '')
    );
  elsif resolution_action = 'suspend_user' then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and account_status = 'active'
    ) then
      raise exception 'Admin permission required to suspend users';
    end if;
    if target_report.target_type = 'user' then
      affected_user_id := target_report.target_id;
    else
      select seller_id into affected_user_id
      from public.books where id = target_report.target_id;
    end if;
    if affected_user_id is null or affected_user_id = auth.uid() then
      raise exception 'Invalid suspension target';
    end if;
    if exists (
      select 1 from public.profiles
      where id = affected_user_id and role = 'admin'
    ) then
      raise exception 'Administrator accounts cannot be suspended';
    end if;

    update public.profiles
    set account_status = 'suspended',
        suspended_at = now(),
        suspended_by = auth.uid(),
        suspension_reason = coalesce(nullif(trim(note), ''), '違反平台規範')
    where id = affected_user_id;

    update public.books
    set moderation_visibility = 'hidden', updated_at = now()
    where seller_id = affected_user_id and status <> 'sold';

    insert into public.notifications (
      recipient_id, actor_id, type, title, message
    ) values (
      affected_user_id,
      auth.uid(),
      'account_suspended',
      '帳號已被停權',
      '你的帳號目前為唯讀模式：' || coalesce(nullif(trim(note), ''), '違反平台規範')
    );
    insert into public.admin_action_logs (
      admin_id, action, target_type, target_id, report_id, reason
    ) values (
      auth.uid(), 'user_suspended', 'user', affected_user_id, target_report.id, coalesce(note, '')
    );
  end if;

  update public.reports
  set status = case when resolution_action = 'dismiss' then 'dismissed' else 'resolved' end,
      resolved_by = auth.uid(),
      resolution_note = coalesce(note, ''),
      resolved_at = now()
  where id = target_report.id;

  insert into public.admin_action_logs (
    admin_id,
    action,
    target_type,
    target_id,
    report_id,
    reason
  ) values (
    auth.uid(),
    case when resolution_action = 'dismiss' then 'report_dismissed' else 'report_resolved' end,
    'report',
    target_report.id,
    target_report.id,
    coalesce(note, '')
  );
end;
$$;

revoke execute on function public.resolve_report(uuid, text, text) from public, anon;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;

create or replace function public.set_account_status(
  target_user_id uuid,
  new_status text,
  reason text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_verified_admin() then
    raise exception 'Admin permission required';
  end if;
  if new_status not in ('active', 'suspended') then
    raise exception 'Invalid account status';
  end if;
  if target_user_id = auth.uid() and new_status = 'suspended' then
    raise exception 'You cannot suspend your own account';
  end if;
  if new_status = 'suspended' and exists (
    select 1 from public.profiles
    where id = target_user_id and role = 'admin'
  ) then
    raise exception 'Administrator accounts cannot be suspended';
  end if;

  update public.profiles
  set account_status = new_status,
      suspended_at = case when new_status = 'suspended' then now() else null end,
      suspended_by = case when new_status = 'suspended' then auth.uid() else null end,
      suspension_reason = case when new_status = 'suspended' then coalesce(reason, '') else '' end
  where id = target_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  if new_status = 'suspended' then
    update public.books
    set moderation_visibility = 'hidden', updated_at = now()
    where seller_id = target_user_id and status <> 'sold';

    insert into public.notifications (
      recipient_id, actor_id, type, title, message
    ) values (
      target_user_id,
      auth.uid(),
      'account_suspended',
      '帳號已被停權',
      '你的帳號目前為唯讀模式：' || coalesce(nullif(trim(reason), ''), '違反平台規範')
    );
  end if;

  insert into public.admin_action_logs (
    admin_id, action, target_type, target_id, reason
  ) values (
    auth.uid(),
    case when new_status = 'suspended' then 'user_suspended' else 'user_restored' end,
    'user',
    target_user_id,
    coalesce(reason, '')
  );
end;
$$;

revoke execute on function public.set_account_status(uuid, text, text) from public, anon;
grant execute on function public.set_account_status(uuid, text, text) to authenticated;

create or replace function public.set_user_role(
  target_user_id uuid,
  new_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_verified_admin() then
    raise exception 'Admin permission required';
  end if;
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'Invalid role';
  end if;
  if target_user_id = auth.uid() and new_role <> 'admin' then
    raise exception 'You cannot remove your own administrator role';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

create or replace function public.set_book_visibility(
  target_book_id uuid,
  new_visibility text,
  reason text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_book public.books;
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;
  if new_visibility not in ('visible', 'hidden') then
    raise exception 'Invalid visibility';
  end if;

  update public.books
  set moderation_visibility = new_visibility, updated_at = now()
  where id = target_book_id
  returning * into target_book;
  if target_book.id is null then
    raise exception 'Book not found';
  end if;

  if new_visibility = 'hidden' then
    insert into public.notifications (
      recipient_id, actor_id, type, book_id, title, message
    ) values (
      target_book.seller_id,
      auth.uid(),
      'book_hidden',
      target_book.id,
      '刊登已被隱藏',
      '《' || target_book.title || '》已由管理員隱藏：' || coalesce(nullif(trim(reason), ''), '違反平台規範')
    );
  end if;

  insert into public.admin_action_logs (
    admin_id, action, target_type, target_id, reason
  ) values (
    auth.uid(),
    case when new_visibility = 'hidden' then 'book_hidden' else 'book_restored' end,
    'book',
    target_book_id,
    coalesce(reason, '')
  );
end;
$$;

revoke execute on function public.set_book_visibility(uuid, text, text) from public, anon;
grant execute on function public.set_book_visibility(uuid, text, text) to authenticated;

create or replace function public.respond_to_purchase_request(
  request_id uuid,
  response public.request_status
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.purchase_requests;
  owner_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if response not in ('accepted', 'rejected') then
    raise exception 'Invalid response';
  end if;

  select * into target
  from public.purchase_requests
  where id = request_id
  for update;
  if target.id is null or target.status <> 'pending' then
    raise exception 'Pending request required';
  end if;

  select seller_id into owner_id
  from public.books
  where id = target.book_id and moderation_visibility = 'visible'
  for update;
  if owner_id <> auth.uid() then
    raise exception 'Only the active seller can respond';
  end if;

  update public.purchase_requests set status = response where id = request_id;
  if response = 'accepted' then
    update public.books
      set status = 'negotiating', updated_at = now()
      where id = target.book_id and status = 'available';
    update public.purchase_requests
      set status = 'rejected'
      where book_id = target.book_id and id <> request_id and status = 'pending';
  end if;
end;
$$;

revoke execute on function public.respond_to_purchase_request(uuid, public.request_status)
  from public, anon;
grant execute on function public.respond_to_purchase_request(uuid, public.request_status)
  to authenticated;

create or replace function public.complete_trade(target_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_book public.books;
  accepted_request public.purchase_requests;
begin
  if not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  select * into target_book
  from public.books
  where id = target_book_id
  for update;
  if target_book.id is null
    or target_book.seller_id <> auth.uid()
    or target_book.status <> 'negotiating'
    or target_book.moderation_visibility <> 'visible' then
    raise exception 'Active seller with negotiating book required';
  end if;

  select * into accepted_request
  from public.purchase_requests
  where book_id = target_book_id and status = 'accepted'
  order by created_at desc
  limit 1;
  if accepted_request.id is null then
    raise exception 'Accepted request required';
  end if;

  update public.books
  set status = 'sold', updated_at = now()
  where id = target_book_id;

  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message
  ) values (
    accepted_request.buyer_id,
    target_book.seller_id,
    'trade_completed',
    target_book_id,
    accepted_request.id,
    '交易已完成',
    '賣家已將《' || target_book.title || '》標記為交易完成'
  );
end;
$$;

revoke execute on function public.complete_trade(uuid) from public, anon;
grant execute on function public.complete_trade(uuid) to authenticated;
