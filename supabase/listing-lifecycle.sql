-- Run after chat-notifications-and-contact-privacy.sql and list-books-pagination.sql.
-- Adds seller activity tracking, listing confirmation cycles, archival, and cleanup audit data.

alter table public.profiles
  add column if not exists last_active_at timestamptz not null default now(),
  add column if not exists listings_confirmed_at timestamptz not null default now(),
  add column if not exists first_listing_notice_at timestamptz;

alter table public.books
  add column if not exists lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'archived', 'withdrawn')),
  add column if not exists listing_confirmed_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text not null default '',
  add column if not exists sanitized_at timestamptz;

alter table public.notifications
  add column if not exists dedupe_key text,
  add column if not exists email_attempts int not null default 0,
  add column if not exists email_last_error text not null default '',
  add column if not exists email_next_attempt_at timestamptz;

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

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
      'account_suspended',
      'trade_message',
      'listing_lifecycle'
    )
  );

insert into public.notifications (
  recipient_id, type, title, message, dedupe_key
)
select distinct
  b.seller_id,
  'listing_lifecycle',
  '課本刊登有效期限說明',
  '新增課本會確認目前公開刊登仍在販售。之後每 30 天提醒確認，120 天仍未確認才暫時封存。',
  'first-listing-policy:' || b.seller_id::text
from public.books b
where b.status <> 'sold'
on conflict (dedupe_key) where dedupe_key is not null do nothing;

update public.profiles p
set first_listing_notice_at = coalesce(p.first_listing_notice_at, now())
where exists (select 1 from public.books b where b.seller_id = p.id);

create table if not exists public.listing_lifecycle_logs (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete set null,
  book_id uuid references public.books(id) on delete set null,
  action text not null check (
    action in (
      'confirmation_reset',
      'seller_confirmed',
      'listing_archived',
      'listing_restored',
      'listing_withdrawn',
      'cleanup_warned',
      'listing_deleted',
      'listing_sanitized'
    )
  ),
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists listing_lifecycle_logs_created_idx
  on public.listing_lifecycle_logs (created_at desc);
create index if not exists books_lifecycle_cleanup_idx
  on public.books (archived_at)
  where lifecycle_state = 'archived';

alter table public.listing_lifecycle_logs enable row level security;
revoke insert, update, delete on table public.listing_lifecycle_logs from anon, authenticated;
grant select on table public.listing_lifecycle_logs to authenticated;
drop policy if exists "Verified admins read lifecycle logs" on public.listing_lifecycle_logs;
create policy "Verified admins read lifecycle logs"
  on public.listing_lifecycle_logs for select to authenticated
  using (public.is_verified_admin());

create or replace function public.record_user_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set last_active_at = now()
  where id = auth.uid()
    and last_active_at < now() - interval '1 hour';
end;
$$;

revoke execute on function public.record_user_activity() from public, anon;
grant execute on function public.record_user_activity() to authenticated;

create or replace function public.reset_seller_listing_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_listing boolean;
begin
  select not exists (
    select 1 from public.books where seller_id = new.seller_id and id <> new.id
  ) into is_first_listing;

  update public.profiles
  set listings_confirmed_at = now(),
      last_active_at = now()
  where id = new.seller_id;

  update public.books
  set listing_confirmed_at = now()
  where seller_id = new.seller_id
    and lifecycle_state = 'active'
    and status = 'available';

  insert into public.listing_lifecycle_logs (seller_id, book_id, action, reason)
  values (new.seller_id, new.id, 'confirmation_reset', 'new_listing');

  if is_first_listing then
    insert into public.notifications (
      recipient_id, type, book_id, title, message, dedupe_key
    ) values (
      new.seller_id,
      'listing_lifecycle',
      new.id,
      '課本刊登有效期限說明',
      '新增課本會確認目前公開刊登仍在販售。之後每 30 天提醒確認，120 天仍未確認才暫時封存。',
      'first-listing-policy:' || new.seller_id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;

    update public.profiles
    set first_listing_notice_at = coalesce(first_listing_notice_at, now())
    where id = new.seller_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.reset_seller_listing_confirmation() from public, anon, authenticated;

drop trigger if exists reset_confirmation_after_new_listing on public.books;
create trigger reset_confirmation_after_new_listing
  after insert on public.books
  for each row execute procedure public.reset_seller_listing_confirmation();

create or replace function public.confirm_all_active_listings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  update public.profiles
  set listings_confirmed_at = now(),
      last_active_at = now()
  where id = auth.uid();

  update public.books
  set listing_confirmed_at = now(),
      updated_at = now()
  where seller_id = auth.uid()
    and lifecycle_state = 'active'
    and status = 'available';

  insert into public.listing_lifecycle_logs (seller_id, action, reason)
  values (auth.uid(), 'seller_confirmed', 'confirm_all_active');
end;
$$;

revoke execute on function public.confirm_all_active_listings() from public, anon;
grant execute on function public.confirm_all_active_listings() to authenticated;

create or replace function public.review_archived_listings(
  keep_book_ids uuid[] default '{}'::uuid[],
  withdraw_book_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invalid_count int;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if coalesce(array_length(keep_book_ids, 1), 0) = 0
    and coalesce(array_length(withdraw_book_ids, 1), 0) = 0 then
    raise exception 'Select at least one listing';
  end if;
  if coalesce(keep_book_ids, '{}'::uuid[]) && coalesce(withdraw_book_ids, '{}'::uuid[]) then
    raise exception 'A listing cannot be kept and withdrawn together';
  end if;

  select count(*) into invalid_count
  from unnest(
    coalesce(keep_book_ids, '{}'::uuid[]) || coalesce(withdraw_book_ids, '{}'::uuid[])
  ) as selected(selected_id)
  where not exists (
    select 1 from public.books
    where id = selected.selected_id
      and seller_id = auth.uid()
      and lifecycle_state = 'archived'
      and status = 'available'
  );
  if invalid_count > 0 then
    raise exception 'Only your archived available listings can be reviewed';
  end if;

  update public.books
  set lifecycle_state = 'active',
      listing_confirmed_at = now(),
      archived_at = null,
      archive_reason = '',
      updated_at = now()
  where seller_id = auth.uid()
    and id = any(coalesce(keep_book_ids, '{}'::uuid[]));

  insert into public.listing_lifecycle_logs (seller_id, book_id, action, reason)
  select auth.uid(), id, 'listing_restored', 'seller_review'
  from public.books
  where seller_id = auth.uid()
    and id = any(coalesce(keep_book_ids, '{}'::uuid[]));

  update public.books
  set lifecycle_state = 'withdrawn',
      updated_at = now()
  where seller_id = auth.uid()
    and id = any(coalesce(withdraw_book_ids, '{}'::uuid[]));

  insert into public.listing_lifecycle_logs (seller_id, book_id, action, reason)
  select auth.uid(), id, 'listing_withdrawn', 'seller_review'
  from public.books
  where seller_id = auth.uid()
    and id = any(coalesce(withdraw_book_ids, '{}'::uuid[]));

  update public.profiles
  set listings_confirmed_at = now(),
      last_active_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.review_archived_listings(uuid[], uuid[]) from public, anon;
grant execute on function public.review_archived_listings(uuid[], uuid[]) to authenticated;

create or replace function public.set_listing_lifecycle(
  target_book_id uuid,
  new_state text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.books;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if new_state not in ('active', 'withdrawn') then
    raise exception 'Invalid lifecycle state';
  end if;

  select * into target from public.books where id = target_book_id for update;
  if target.id is null or target.seller_id <> auth.uid() then
    raise exception 'Listing owner required';
  end if;
  if target.status = 'negotiating' then
    raise exception 'Negotiating listings cannot be withdrawn';
  end if;

  update public.books
  set lifecycle_state = new_state,
      listing_confirmed_at = case when new_state = 'active' then now() else listing_confirmed_at end,
      archived_at = case when new_state = 'active' then null else archived_at end,
      archive_reason = case when new_state = 'active' then '' else archive_reason end,
      updated_at = now()
  where id = target_book_id;

  insert into public.listing_lifecycle_logs (seller_id, book_id, action, reason)
  values (
    auth.uid(),
    target_book_id,
    case when new_state = 'active' then 'listing_restored' else 'listing_withdrawn' end,
    'seller_action'
  );
end;
$$;

revoke execute on function public.set_listing_lifecycle(uuid, text) from public, anon;
grant execute on function public.set_listing_lifecycle(uuid, text) to authenticated;

create or replace function public.process_listing_lifecycle(reference_time timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  seller record;
  archived_count int := 0;
  notification_count int := 0;
  changed_count int;
  cycle_key text;
  archive_reason_value text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  for seller in
    select p.*
    from public.profiles p
    where exists (
      select 1 from public.books b
      where b.seller_id = p.id
        and b.lifecycle_state = 'active'
        and b.status = 'available'
    )
  loop
    cycle_key := to_char(seller.listings_confirmed_at at time zone 'UTC', 'YYYYMMDDHH24MISS');

    if seller.last_active_at <= reference_time - interval '60 days'
      and seller.last_active_at > reference_time - interval '120 days' then
      insert into public.notifications (
        recipient_id, type, title, message, dedupe_key
      ) values (
        seller.id,
        'listing_lifecycle',
        '你已一段時間沒有回來',
        '你已有 60 天未登入。超過 120 天時，系統會暫時封存仍在販售的課本。',
        'inactive-60:' || seller.id::text || ':' || to_char(seller.last_active_at at time zone 'UTC', 'YYYYMMDD')
      ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics changed_count = row_count;
      notification_count := notification_count + changed_count;
    end if;

    if seller.listings_confirmed_at <= reference_time - interval '30 days'
      and seller.listings_confirmed_at > reference_time - interval '60 days' then
      insert into public.notifications (
        recipient_id, type, title, message, dedupe_key
      ) values (
        seller.id,
        'listing_lifecycle',
        '請確認課本仍在販售',
        '你的 30 天確認週期已到。請登入後按一次「全部仍在販售」。',
        'listing-30:' || seller.id::text || ':' || cycle_key
      ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics changed_count = row_count;
      notification_count := notification_count + changed_count;
    end if;

    if seller.listings_confirmed_at <= reference_time - interval '60 days'
      and seller.listings_confirmed_at > reference_time - interval '90 days' then
      insert into public.notifications (
        recipient_id, type, title, message, dedupe_key
      ) values (
        seller.id,
        'listing_lifecycle',
        '課本仍在販售嗎？',
        '你已 60 天未確認公開課本。按「全部仍在販售」可重新開始 30 天確認週期。',
        'listing-60:' || seller.id::text || ':' || cycle_key
      ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics changed_count = row_count;
      notification_count := notification_count + changed_count;
    end if;

    if seller.listings_confirmed_at <= reference_time - interval '90 days'
      and seller.listings_confirmed_at > reference_time - interval '113 days' then
      insert into public.notifications (
        recipient_id, type, title, message, dedupe_key
      ) values (
        seller.id,
        'listing_lifecycle',
        '課本確認已逾期 90 天',
        '請確認公開課本是否仍在販售；滿 120 天仍未確認時將暫時封存。',
        'listing-90:' || seller.id::text || ':' || cycle_key
      ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics changed_count = row_count;
      notification_count := notification_count + changed_count;
    end if;

    if seller.listings_confirmed_at <= reference_time - interval '113 days'
      and seller.listings_confirmed_at > reference_time - interval '120 days' then
      insert into public.notifications (
        recipient_id, type, title, message, dedupe_key
      ) values (
        seller.id,
        'listing_lifecycle',
        '課本即將暫時封存',
        '這是最後提醒：若 120 天內仍未確認，系統會暫時封存販售中課本；洽談中的交易不受影響。',
        'listing-113:' || seller.id::text || ':' || cycle_key
      ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics changed_count = row_count;
      notification_count := notification_count + changed_count;
    end if;

    if seller.last_active_at <= reference_time - interval '120 days'
      or seller.listings_confirmed_at <= reference_time - interval '120 days' then
      archive_reason_value := case
        when seller.last_active_at <= reference_time - interval '120 days'
          then 'inactive_120_days'
        else 'unconfirmed_120_days'
      end;

      update public.books
      set lifecycle_state = 'archived',
          archived_at = reference_time,
          archive_reason = archive_reason_value,
          updated_at = reference_time
      where seller_id = seller.id
        and lifecycle_state = 'active'
        and status = 'available';
      get diagnostics changed_count = row_count;
      archived_count := archived_count + changed_count;

      if changed_count > 0 then
        insert into public.listing_lifecycle_logs (
          seller_id, book_id, action, reason
        )
        select seller.id, id, 'listing_archived', archive_reason_value
        from public.books
        where seller_id = seller.id
          and lifecycle_state = 'archived'
          and archived_at = reference_time;

        insert into public.notifications (
          recipient_id, type, title, message, dedupe_key
        ) values (
          seller.id,
          'listing_lifecycle',
          '販售中課本已暫時封存',
          '為避免幽靈課本，逾期未確認的刊登已從公開市場移除。登入後可逐本選擇恢復販售或正式下架。',
          'listing-archived:' || seller.id::text || ':' || cycle_key || ':' || archive_reason_value
        ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
        get diagnostics changed_count = row_count;
        notification_count := notification_count + changed_count;
      end if;
    end if;
  end loop;

  insert into public.notifications (
    recipient_id, type, book_id, title, message, dedupe_key
  )
  select
    b.seller_id,
    'listing_lifecycle',
    b.id,
    '封存課本將於 7 天後清理',
    '《' || b.title || '》已封存接近一年。系統將清理圖片與非必要資料；若仍要販售，請在期限前恢復。',
    'listing-cleanup-warning:' || b.id::text || ':' || to_char(b.archived_at at time zone 'UTC', 'YYYYMMDD')
  from public.books b
  where b.lifecycle_state = 'archived'
    and b.archived_at <= reference_time - interval '358 days'
    and b.archived_at > reference_time - interval '365 days'
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics changed_count = row_count;
  notification_count := notification_count + changed_count;

  insert into public.listing_lifecycle_logs (seller_id, book_id, action, reason)
  select b.seller_id, b.id, 'cleanup_warned', 'archived_358_days'
  from public.books b
  where b.lifecycle_state = 'archived'
    and b.archived_at <= reference_time - interval '358 days'
    and b.archived_at > reference_time - interval '365 days'
    and exists (
      select 1 from public.notifications n
      where n.dedupe_key = 'listing-cleanup-warning:' || b.id::text || ':' || to_char(b.archived_at at time zone 'UTC', 'YYYYMMDD')
        and n.created_at >= reference_time - interval '1 day'
    )
    and not exists (
      select 1 from public.listing_lifecycle_logs l
      where l.book_id = b.id and l.action = 'cleanup_warned'
    );

  return jsonb_build_object(
    'archived', archived_count,
    'notifications_created', notification_count
  );
end;
$$;

revoke execute on function public.process_listing_lifecycle(timestamptz) from public, anon, authenticated;
grant execute on function public.process_listing_lifecycle(timestamptz) to service_role;

-- Public catalog and profile lookups must ignore archived and withdrawn listings.
drop policy if exists "Approved visible books are public and owners can review records" on public.books;
drop policy if exists "Approved active books are public and parties can review records" on public.books;
create policy "Approved active books are public and parties can review records"
  on public.books for select
  using (
    (
      review_status = 'approved'
      and moderation_visibility = 'visible'
      and lifecycle_state = 'active'
    )
    or seller_id = auth.uid()
    or public.is_moderator()
    or public.is_book_buyer(books.id)
  );

create or replace function public.get_public_profiles()
returns table (id uuid, name text, department text)
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id, profiles.name, profiles.department
  from public.profiles
  where profiles.account_status = 'active'
    and exists (
      select 1 from public.books
      where books.seller_id = profiles.id
        and books.review_status = 'approved'
        and books.moderation_visibility = 'visible'
        and books.lifecycle_state = 'active'
        and books.status <> 'sold'
    )
  order by profiles.name;
$$;

revoke execute on function public.get_public_profiles() from public;
grant execute on function public.get_public_profiles() to anon, authenticated;

create or replace function public.list_seller_lifecycle()
returns table (
  last_active_at timestamptz,
  listings_confirmed_at timestamptz,
  first_listing_notice_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.last_active_at, p.listings_confirmed_at, p.first_listing_notice_at
  from public.profiles p where p.id = auth.uid();
$$;

revoke execute on function public.list_seller_lifecycle() from public, anon;
grant execute on function public.list_seller_lifecycle() to authenticated;

-- Recreate paginated RPCs with lifecycle fields and active-only public filtering.
drop function if exists public.list_books_page(int, timestamptz, uuid, text, int, text);
create function public.list_books_page(
  p_limit int default 24,
  p_cursor_created timestamptz default null,
  p_cursor_id uuid default null,
  p_department text default null,
  p_max_price int default null,
  p_query text default null
)
returns table (
  id uuid, seller_id uuid, title text, author text, department text, course text,
  teacher text, edition text, condition text, price int, image_url text, meetup text,
  description text, status public.book_status, review_status text, review_note text,
  moderation_visibility text, lifecycle_state text, listing_confirmed_at timestamptz,
  archived_at timestamptz, archive_reason text, created_at timestamptz, updated_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select
    b.id, b.seller_id, b.title, b.author, b.department, b.course, b.teacher,
    b.edition, b.condition, b.price, b.image_url, b.meetup, b.description,
    b.status, b.review_status, b.review_note, b.moderation_visibility,
    b.lifecycle_state, b.listing_confirmed_at, b.archived_at, b.archive_reason,
    b.created_at, b.updated_at
  from public.books b
  where b.review_status = 'approved'
    and b.moderation_visibility = 'visible'
    and b.lifecycle_state = 'active'
    and b.status <> 'sold'
    and (p_department is null or b.department = p_department)
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null or btrim(p_query) = ''
      or (b.title || ' ' || b.author || ' ' || b.course || ' ' || b.teacher)
        ilike '%' || replace(replace(btrim(p_query), '\', '\\'), '%', '\%') || '%' escape '\'
    )
    and (
      p_cursor_created is null or p_cursor_id is null
      or (b.created_at, b.id) < (p_cursor_created, p_cursor_id)
    )
  order by b.created_at desc, b.id desc
  limit greatest(least(coalesce(p_limit, 24), 100), 1);
$$;

drop function if exists public.count_books_filtered(text, int, text);
create function public.count_books_filtered(
  p_department text default null,
  p_max_price int default null,
  p_query text default null
)
returns bigint
language sql stable security invoker set search_path = public
as $$
  select count(*)::bigint
  from public.books b
  where b.review_status = 'approved'
    and b.moderation_visibility = 'visible'
    and b.lifecycle_state = 'active'
    and b.status <> 'sold'
    and (p_department is null or b.department = p_department)
    and (p_max_price is null or b.price <= p_max_price)
    and (
      p_query is null or btrim(p_query) = ''
      or (b.title || ' ' || b.author || ' ' || b.course || ' ' || b.teacher)
        ilike '%' || replace(replace(btrim(p_query), '\', '\\'), '%', '\%') || '%' escape '\'
    );
$$;

drop function if exists public.list_my_books();
create function public.list_my_books()
returns table (
  id uuid, seller_id uuid, title text, author text, department text, course text,
  teacher text, edition text, condition text, price int, image_url text, meetup text,
  description text, status public.book_status, review_status text, review_note text,
  moderation_visibility text, lifecycle_state text, listing_confirmed_at timestamptz,
  archived_at timestamptz, archive_reason text, created_at timestamptz, updated_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select
    b.id, b.seller_id, b.title, b.author, b.department, b.course, b.teacher,
    b.edition, b.condition, b.price, b.image_url, b.meetup, b.description,
    b.status, b.review_status, b.review_note, b.moderation_visibility,
    b.lifecycle_state, b.listing_confirmed_at, b.archived_at, b.archive_reason,
    b.created_at, b.updated_at
  from public.books b
  where b.seller_id = auth.uid()
  order by
    case b.lifecycle_state when 'archived' then 0 when 'active' then 1 else 2 end,
    b.created_at desc, b.id desc;
$$;

revoke execute on function public.list_books_page(int, timestamptz, uuid, text, int, text) from public;
revoke execute on function public.count_books_filtered(text, int, text) from public;
revoke execute on function public.list_my_books() from public;
grant execute on function public.list_books_page(int, timestamptz, uuid, text, int, text) to anon, authenticated;
grant execute on function public.count_books_filtered(text, int, text) to anon, authenticated;
grant execute on function public.list_my_books() to authenticated;

drop policy if exists "Active buyers can create valid requests" on public.purchase_requests;
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
        and books.lifecycle_state = 'active'
        and public.is_active_user(books.seller_id)
    )
  );

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
  where id = target.book_id
    and moderation_visibility = 'visible'
    and lifecycle_state = 'active'
  for update;
  if owner_id <> auth.uid() then
    raise exception 'Only the active seller can respond';
  end if;

  update public.purchase_requests set status = response where id = request_id;
  if response = 'accepted' then
    update public.books
      set status = 'negotiating', updated_at = now()
      where id = target.book_id
        and status = 'available'
        and lifecycle_state = 'active';
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

drop index if exists public.books_public_catalog_idx;
drop index if exists public.books_public_catalog_dept_idx;
create index books_public_catalog_idx
  on public.books (created_at desc, id desc)
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and lifecycle_state = 'active'
    and status <> 'sold';
create index books_public_catalog_dept_idx
  on public.books (department, created_at desc, id desc)
  where review_status = 'approved'
    and moderation_visibility = 'visible'
    and lifecycle_state = 'active'
    and status <> 'sold';
