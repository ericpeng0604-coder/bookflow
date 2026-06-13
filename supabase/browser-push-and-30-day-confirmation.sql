-- Run after multi-party-orders-and-safe-chat.sql.
-- Adds browser push delivery and changes the seller confirmation prompt to 30 days.

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_attempts int not null default 0,
  add column if not exists push_last_error text not null default '',
  add column if not exists push_next_attempt_at timestamptz;

create index if not exists notifications_push_pending_idx
  on public.notifications (created_at)
  where push_sent_at is null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  enabled boolean not null default true,
  failure_count int not null default 0,
  last_success_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, enabled);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read their push subscriptions" on public.push_subscriptions;
drop policy if exists "Users create their push subscriptions" on public.push_subscriptions;
drop policy if exists "Users update their push subscriptions" on public.push_subscriptions;
drop policy if exists "Users delete their push subscriptions" on public.push_subscriptions;

create policy "Users read their push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy "Users create their push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users update their push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Users delete their push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create or replace function public.increment_push_subscription_failure(
  target_subscription_id uuid,
  error_message text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions
  set failure_count = failure_count + 1,
      last_error = left(coalesce(error_message, ''), 500),
      enabled = failure_count + 1 < 5,
      updated_at = now()
  where id = target_subscription_id;
$$;

revoke execute on function public.increment_push_subscription_failure(uuid, text)
  from public, anon, authenticated;
grant execute on function public.increment_push_subscription_failure(uuid, text)
  to service_role;

create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare target public.conversations; recipient uuid; target_book public.books; sender_name text;
begin
  select * into target from public.conversations where id = new.conversation_id;
  select * into target_book from public.books where id = target.book_id;
  recipient := case when new.sender_id = target.buyer_id then target.seller_id else target.buyer_id end;
  select name into sender_name from public.profiles where id = new.sender_id;
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, conversation_id, title, message, dedupe_key
  ) values (
    recipient, new.sender_id, 'trade_message', target.book_id, target.id, '收到新的聊聊訊息',
    coalesce(sender_name, '對方') || '：' ||
      case when btrim(coalesce(new.body, '')) = '' then '傳送了圖片' else left(new.body, 80) end,
    'trade-message:' || new.id::text
  ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
  return new;
end; $$;

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
        seller.id, 'listing_lifecycle', '請確認課本仍在販售',
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
        seller.id, 'listing_lifecycle', '課本仍在販售嗎？',
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
        seller.id, 'listing_lifecycle', '課本確認已逾期 90 天',
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
        seller.id, 'listing_lifecycle', '課本即將暫時封存',
        '這是最後提醒：滿 120 天仍未確認時，系統會暫時封存販售中課本；洽談中的交易不受影響。',
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
        insert into public.listing_lifecycle_logs (seller_id, book_id, action, reason)
        select seller.id, id, 'listing_archived', archive_reason_value
        from public.books
        where seller_id = seller.id
          and lifecycle_state = 'archived'
          and archived_at = reference_time;

        insert into public.notifications (
          recipient_id, type, title, message, dedupe_key
        ) values (
          seller.id, 'listing_lifecycle', '販售中課本已暫時封存',
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
    b.seller_id, 'listing_lifecycle', b.id, '封存課本將於 7 天後清理',
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
      where n.dedupe_key = 'listing-cleanup-warning:' || b.id::text || ':' ||
        to_char(b.archived_at at time zone 'UTC', 'YYYYMMDD')
        and n.created_at >= reference_time - interval '1 day'
    )
    and not exists (
      select 1 from public.listing_lifecycle_logs l
      where l.book_id = b.id and l.action = 'cleanup_warned'
    );

  return jsonb_build_object(
    'archived_books', archived_count,
    'notifications_created', notification_count
  );
end;
$$;

create extension if not exists pg_net;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'dispatch-browser-push-hourly';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'dispatch-browser-push-hourly',
    '22 * * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'bookflow_push_dispatch_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'bookflow_push_dispatch_secret')
        ),
        body := '{}'::jsonb
      )
      where exists (
        select 1 from vault.decrypted_secrets where name = 'bookflow_push_dispatch_url'
      ) and exists (
        select 1 from vault.decrypted_secrets where name = 'bookflow_push_dispatch_secret'
      );
    $command$
  );
end $$;
