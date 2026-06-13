-- Run after listing-lifecycle.sql.
-- Multi-party conversations, server favorites, reservation orders, and hourly automation.

drop function if exists public.respond_to_purchase_request(uuid, public.request_status);
drop function if exists public.complete_trade(uuid);
drop policy if exists "Trading parties can read requests" on public.purchase_requests;
drop policy if exists "Active buyers can create valid requests" on public.purchase_requests;
drop policy if exists "Buyers can create valid requests" on public.purchase_requests;
drop policy if exists "Buyers can cancel pending requests" on public.purchase_requests;
drop policy if exists "Trade participants read messages" on public.trade_messages;
drop policy if exists "Trade participants send messages" on public.trade_messages;
drop index if exists public.purchase_requests_one_active_per_buyer;

alter table public.purchase_requests
  alter column status drop default,
  alter column status type text using status::text,
  add column if not exists title_snapshot text not null default '',
  add column if not exists price_snapshot integer not null default 0,
  add column if not exists edition_snapshot text not null default '',
  add column if not exists image_snapshot text not null default '',
  add column if not exists meetup_snapshot text not null default '',
  add column if not exists reminded_at timestamptz,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists seller_handoff_at timestamptz,
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text not null default '',
  add column if not exists updated_at timestamptz not null default now();
alter table public.purchase_requests alter column status set default 'pending';
alter table public.purchase_requests drop constraint if exists purchase_requests_message_check;
alter table public.purchase_requests
  add constraint purchase_requests_message_check check (char_length(message) <= 500);

alter table public.purchase_requests
  drop constraint if exists purchase_requests_status_check;
alter table public.purchase_requests
  add constraint purchase_requests_status_check check (
    status in (
      'pending', 'waitlisted', 'reserved', 'awaiting_confirmation',
      'completed', 'rejected', 'cancelled', 'expired'
    )
  );

update public.purchase_requests pr
set title_snapshot = b.title,
    price_snapshot = b.price,
    edition_snapshot = b.edition,
    image_snapshot = b.image_url,
    meetup_snapshot = b.meetup,
    status = case when pr.status = 'accepted' then 'reserved' else pr.status end,
    reservation_expires_at = case
      when pr.status = 'accepted' then coalesce(pr.reservation_expires_at, now() + interval '7 days')
      else pr.reservation_expires_at
    end,
    updated_at = now()
from public.books b
where b.id = pr.book_id
  and (
    pr.title_snapshot = ''
    or pr.status = 'accepted'
  );

create unique index purchase_requests_one_active_per_buyer
  on public.purchase_requests (book_id, buyer_id)
  where status in ('pending', 'waitlisted', 'reserved', 'awaiting_confirmation');
create unique index purchase_requests_one_selected_per_book
  on public.purchase_requests (book_id)
  where status in ('reserved', 'awaiting_confirmation');
create index if not exists purchase_requests_deadline_idx
  on public.purchase_requests (status, created_at, reservation_expires_at, seller_handoff_at);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  closed_reason text not null default '',
  buyer_read_at timestamptz not null default now(),
  seller_read_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create unique index if not exists conversations_one_active_pair
  on public.conversations (book_id, buyer_id)
  where status = 'active';
create index if not exists conversations_buyer_last_idx
  on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_seller_last_idx
  on public.conversations (seller_id, last_message_at desc);

insert into public.conversations (book_id, buyer_id, seller_id, status, last_message_at, created_at)
select pr.book_id, pr.buyer_id, b.seller_id,
       case when pr.status in ('rejected', 'cancelled', 'expired') then 'closed' else 'active' end,
       coalesce(max(tm.created_at), pr.created_at),
       pr.created_at
from public.purchase_requests pr
join public.books b on b.id = pr.book_id
left join public.trade_messages tm on tm.request_id = pr.id
where exists (select 1 from public.trade_messages existing where existing.request_id = pr.id)
group by pr.id, pr.book_id, pr.buyer_id, b.seller_id, pr.status, pr.created_at
on conflict (book_id, buyer_id) where status = 'active' do nothing;

alter table public.trade_messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists image_paths text[] not null default '{}'::text[],
  add column if not exists recalled_at timestamptz,
  add column if not exists recalled_body text;
alter table public.trade_messages drop constraint if exists trade_messages_body_check;
alter table public.trade_messages
  add constraint trade_messages_body_check check (
    char_length(coalesce(body, '')) <= 500
    and (
      recalled_at is not null
      or btrim(coalesce(body, '')) <> ''
      or coalesce(array_length(image_paths, 1), 0) > 0
    )
  ) not valid;

update public.trade_messages tm
set conversation_id = c.id
from public.purchase_requests pr
join public.conversations c
  on c.book_id = pr.book_id and c.buyer_id = pr.buyer_id
where tm.request_id = pr.id
  and tm.conversation_id is null;

alter table public.trade_messages alter column request_id drop not null;
alter table public.trade_messages alter column body drop not null;
drop index if exists public.trade_messages_request_idx;
create index if not exists trade_messages_conversation_idx
  on public.trade_messages (conversation_id, created_at);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists favorites_book_idx on public.favorites (book_id);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.trade_messages(id) on delete set null,
  reason text not null check (reason in ('harassment', 'fraud', 'spam', 'sensitive_data', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists order_events_dedupe_idx
  on public.order_events (dedupe_key) where dedupe_key is not null;
create index if not exists order_events_request_idx
  on public.order_events (request_id, created_at);

alter table public.conversations enable row level security;
alter table public.favorites enable row level security;
alter table public.user_blocks enable row level security;
alter table public.chat_reports enable row level security;
alter table public.order_events enable row level security;

drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations"
  on public.conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));

drop policy if exists "Users manage favorites" on public.favorites;
create policy "Users manage favorites"
  on public.favorites for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users read their blocks" on public.user_blocks;
drop policy if exists "Users create their blocks" on public.user_blocks;
drop policy if exists "Users delete their blocks" on public.user_blocks;
create policy "Users read their blocks"
  on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "Users create their blocks"
  on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "Users delete their blocks"
  on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists "Reporters read chat reports" on public.chat_reports;
create policy "Reporters read chat reports"
  on public.chat_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_verified_admin());

drop policy if exists "Parties read order events" on public.order_events;
create policy "Parties read order events"
  on public.order_events for select to authenticated
  using (
    exists (
      select 1 from public.purchase_requests pr
      join public.books b on b.id = pr.book_id
      where pr.id = order_events.request_id
        and auth.uid() in (pr.buyer_id, b.seller_id)
    )
  );

revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.chat_reports from anon, authenticated;
revoke insert, update, delete on public.order_events from anon, authenticated;
grant select on public.conversations, public.chat_reports, public.order_events to authenticated;
grant select, insert, delete on public.favorites, public.user_blocks to authenticated;

drop policy if exists "Trade participants read messages" on public.trade_messages;
drop policy if exists "Trade participants send messages" on public.trade_messages;
create policy "Conversation participants read messages"
  on public.trade_messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = trade_messages.conversation_id
        and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );
revoke insert, update, delete on public.trade_messages from authenticated;
grant select on public.trade_messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images', 'chat-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Conversation participants read chat images" on storage.objects;
drop policy if exists "Conversation participants upload chat images" on storage.objects;
drop policy if exists "Chat image owners delete uploads" on storage.objects;
create policy "Conversation participants read chat images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );
create policy "Conversation participants upload chat images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.status = 'active'
        and auth.uid() in (c.buyer_id, c.seller_id)
        and not exists (
          select 1 from public.user_blocks ub
          where (ub.blocker_id = c.buyer_id and ub.blocked_id = c.seller_id)
             or (ub.blocker_id = c.seller_id and ub.blocked_id = c.buyer_id)
        )
    )
  );
create policy "Chat image owners delete uploads"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'request_created', 'request_accepted', 'request_rejected', 'trade_completed',
      'book_approved', 'book_rejected', 'book_hidden', 'account_suspended',
      'trade_message', 'listing_lifecycle', 'order_reminder', 'order_expired',
      'reservation_cancelled', 'handoff_confirmation', 'book_sold'
    )
  );

create or replace function public.start_conversation(target_book_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_book public.books;
  existing_id uuid;
  created_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  select * into target_book from public.books where id = target_book_id;
  if target_book.id is null or target_book.seller_id = auth.uid()
    or target_book.status = 'sold' or target_book.lifecycle_state <> 'active'
    or target_book.review_status <> 'approved' or target_book.moderation_visibility <> 'visible' then
    raise exception 'Available listing required';
  end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = target_book.seller_id)
       or (blocker_id = target_book.seller_id and blocked_id = auth.uid())
  ) then
    raise exception 'Conversation is blocked';
  end if;
  select id into existing_id from public.conversations
  where book_id = target_book_id and buyer_id = auth.uid() and status = 'active';
  if existing_id is not null then return existing_id; end if;
  insert into public.conversations (book_id, buyer_id, seller_id)
  values (target_book_id, auth.uid(), target_book.seller_id)
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.list_my_conversations()
returns table (
  id uuid, book_id uuid, buyer_id uuid, seller_id uuid, status text,
  closed_reason text, last_message_at timestamptz, unread_count bigint, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.book_id, c.buyer_id, c.seller_id, c.status, c.closed_reason,
         c.last_message_at,
         (
           select count(*) from public.trade_messages tm
           where tm.conversation_id = c.id
             and tm.sender_id <> auth.uid()
             and tm.created_at > case when auth.uid() = c.buyer_id then c.buyer_read_at else c.seller_read_at end
         )::bigint,
         c.created_at
  from public.conversations c
  where auth.uid() in (c.buyer_id, c.seller_id)
  order by c.last_message_at desc;
$$;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set buyer_read_at = case when buyer_id = auth.uid() then now() else buyer_read_at end,
      seller_read_at = case when seller_id = auth.uid() then now() else seller_read_at end
  where id = target_conversation_id and auth.uid() in (buyer_id, seller_id);
  if not found then raise exception 'Conversation participant required'; end if;
end;
$$;

create or replace function public.send_chat_message(
  target_conversation_id uuid,
  message_body text default '',
  message_images text[] default '{}'::text[]
)
returns table (
  id uuid, conversation_id uuid, sender_id uuid, body text,
  image_paths text[], recalled_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.conversations;
  created public.trade_messages;
  other_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Active account required'; end if;
  select * into target from public.conversations where conversations.id = target_conversation_id for update;
  if target.id is null or target.status <> 'active' or auth.uid() not in (target.buyer_id, target.seller_id) then
    raise exception 'Active conversation required';
  end if;
  other_id := case when auth.uid() = target.buyer_id then target.seller_id else target.buyer_id end;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = other_id)
       or (blocker_id = other_id and blocked_id = auth.uid())
  ) then raise exception 'Conversation is blocked'; end if;
  if char_length(btrim(coalesce(message_body, ''))) > 500 then raise exception 'Message too long'; end if;
  if coalesce(array_length(message_images, 1), 0) > 5 then raise exception 'Up to five images per message'; end if;
  if btrim(coalesce(message_body, '')) = '' and coalesce(array_length(message_images, 1), 0) = 0 then
    raise exception 'Message content required';
  end if;
  if (
    select count(*) from public.trade_messages
    where trade_messages.sender_id = auth.uid() and trade_messages.created_at > now() - interval '1 minute'
  ) >= 10 then raise exception 'Too many messages; try again shortly'; end if;
  if btrim(coalesce(message_body, '')) <> '' and exists (
    select 1 from public.trade_messages
    where trade_messages.conversation_id = target.id
      and trade_messages.sender_id = auth.uid()
      and trade_messages.body = btrim(message_body)
      and trade_messages.created_at > now() - interval '20 seconds'
  ) then raise exception 'Duplicate message'; end if;

  insert into public.trade_messages (conversation_id, sender_id, body, image_paths)
  values (target.id, auth.uid(), btrim(coalesce(message_body, '')), coalesce(message_images, '{}'::text[]))
  returning * into created;
  update public.conversations
  set last_message_at = created.created_at, updated_at = created.created_at
  where conversations.id = target.id;
  return query select created.id, created.conversation_id, created.sender_id, created.body,
                      created.image_paths, created.recalled_at, created.created_at;
end;
$$;

create or replace function public.recall_chat_message(target_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trade_messages
  set recalled_body = body, body = '', recalled_at = now()
  where id = target_message_id
    and sender_id = auth.uid()
    and recalled_at is null
    and created_at >= now() - interval '10 minutes';
  if not found then raise exception 'Only your message can be recalled within ten minutes'; end if;
end;
$$;

create or replace function public.close_conversation(target_conversation_id uuid, reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set status = 'closed', closed_reason = left(btrim(coalesce(reason, '')), 300), updated_at = now()
  where id = target_conversation_id and status = 'active' and auth.uid() in (buyer_id, seller_id);
  if not found then raise exception 'Active conversation participant required'; end if;
end;
$$;

create or replace function public.set_user_block(target_user_id uuid, should_block boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id = auth.uid() then raise exception 'Cannot block yourself'; end if;
  if should_block then
    insert into public.user_blocks (blocker_id, blocked_id)
    values (auth.uid(), target_user_id) on conflict do nothing;
  else
    delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = target_user_id;
  end if;
end;
$$;

create or replace function public.submit_chat_report(
  target_conversation_id uuid,
  target_message_id uuid default null,
  report_reason text default 'other',
  report_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare created_id uuid;
begin
  if report_reason not in ('harassment', 'fraud', 'spam', 'sensitive_data', 'other') then
    raise exception 'Invalid report reason';
  end if;
  if not exists (
    select 1 from public.conversations
    where id = target_conversation_id and auth.uid() in (buyer_id, seller_id)
  ) then raise exception 'Conversation participant required'; end if;
  if target_message_id is not null and not exists (
    select 1 from public.trade_messages
    where id = target_message_id and conversation_id = target_conversation_id
  ) then raise exception 'Message does not belong to conversation'; end if;
  insert into public.chat_reports (reporter_id, conversation_id, message_id, reason, details)
  values (auth.uid(), target_conversation_id, target_message_id, report_reason, btrim(report_details))
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.create_purchase_request(target_book_id uuid, request_message text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare target_book public.books; created_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Active account required'; end if;
  select * into target_book from public.books where id = target_book_id for update;
  if target_book.id is null or target_book.seller_id = auth.uid()
    or target_book.status <> 'available' or target_book.lifecycle_state <> 'active'
    or target_book.review_status <> 'approved' or target_book.moderation_visibility <> 'visible' then
    raise exception 'Book is not accepting orders';
  end if;
  insert into public.purchase_requests (
    book_id, buyer_id, message, status, title_snapshot, price_snapshot,
    edition_snapshot, image_snapshot, meetup_snapshot
  ) values (
    target_book.id, auth.uid(), left(coalesce(request_message, ''), 500), 'pending',
    target_book.title, target_book.price, target_book.edition, target_book.image_url, target_book.meetup
  ) returning id into created_id;
  insert into public.order_events (request_id, event_type, actor_id)
  values (created_id, 'requested', auth.uid());
  return created_id;
end;
$$;

create or replace function public.respond_to_purchase_request(request_id uuid, response text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target public.purchase_requests; target_book public.books;
begin
  if response not in ('accepted', 'rejected') then raise exception 'Invalid response'; end if;
  select * into target from public.purchase_requests where id = request_id for update;
  select * into target_book from public.books where id = target.book_id for update;
  if target.id is null or target.status not in ('pending', 'waitlisted')
    or target_book.seller_id <> auth.uid() then raise exception 'Seller action required'; end if;
  if response = 'rejected' then
    update public.purchase_requests set status = 'rejected', updated_at = now() where id = target.id;
    insert into public.order_events (request_id, event_type, actor_id) values (target.id, 'rejected', auth.uid());
    insert into public.notifications (
      recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
    ) values (
      target.buyer_id, auth.uid(), 'request_rejected', target.book_id, target.id,
      '購買請求未被選定', '賣家未選擇你購買《' || target.title_snapshot || '》',
      'request-rejected:' || target.id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
    return;
  end if;
  if target_book.status <> 'available' then raise exception 'Another buyer is already reserved'; end if;
  update public.purchase_requests
  set status = 'waitlisted', updated_at = now()
  where book_id = target.book_id and id <> target.id and status = 'pending';
  update public.purchase_requests
  set status = 'reserved', reservation_expires_at = now() + interval '7 days', updated_at = now()
  where id = target.id;
  update public.books set status = 'negotiating', updated_at = now() where id = target.book_id;
  insert into public.order_events (request_id, event_type, actor_id, details)
  values (target.id, 'reserved', auth.uid(), jsonb_build_object('expires_at', now() + interval '7 days'));
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
  ) values (
    target.buyer_id, auth.uid(), 'request_accepted', target.book_id, target.id,
    '你已被賣家選定', '《' || target.title_snapshot || '》為你保留 7 天，請和賣家完成面交',
    'request-reserved:' || target.id::text
  ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

create or replace function public.cancel_purchase_request(target_request_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target public.purchase_requests; target_book public.books;
begin
  if char_length(btrim(coalesce(reason, ''))) < 2 then raise exception 'Cancellation reason required'; end if;
  select * into target from public.purchase_requests where id = target_request_id for update;
  select * into target_book from public.books where id = target.book_id for update;
  if target.id is null or auth.uid() not in (target.buyer_id, target_book.seller_id)
    or target.status not in ('pending', 'waitlisted', 'reserved', 'awaiting_confirmation') then
    raise exception 'Cancellable order required';
  end if;
  update public.purchase_requests
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = left(btrim(reason), 500), updated_at = now()
  where id = target.id;
  if target.status in ('reserved', 'awaiting_confirmation') then
    update public.books set status = 'available', updated_at = now() where id = target.book_id;
    update public.purchase_requests set status = 'pending', updated_at = now()
    where book_id = target.book_id and status = 'waitlisted';
  end if;
  insert into public.order_events (request_id, event_type, actor_id, details)
  values (target.id, 'cancelled', auth.uid(), jsonb_build_object('reason', left(btrim(reason), 500)));
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
  ) values (
    case when auth.uid() = target.buyer_id then target_book.seller_id else target.buyer_id end,
    auth.uid(), 'reservation_cancelled', target.book_id, target.id,
    '訂單已取消', '《' || target.title_snapshot || '》的訂單已取消：' || left(btrim(reason), 200),
    'order-cancelled:' || target.id::text || ':' || extract(epoch from now())::bigint::text
  );
end;
$$;

create or replace function public.seller_confirm_handoff(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.purchase_requests pr
  set status = 'awaiting_confirmation', seller_handoff_at = now(), updated_at = now()
  from public.books b
  where pr.id = target_request_id and b.id = pr.book_id
    and b.seller_id = auth.uid() and pr.status = 'reserved';
  if not found then raise exception 'Reserved order seller required'; end if;
  insert into public.order_events (request_id, event_type, actor_id)
  values (target_request_id, 'seller_handoff', auth.uid());
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
  )
  select pr.buyer_id, auth.uid(), 'handoff_confirmation', pr.book_id, pr.id,
         '請確認已收到課本', '賣家已將《' || pr.title_snapshot || '》標記為完成面交，請於 48 小時內確認',
         'handoff-confirm:' || pr.id::text
  from public.purchase_requests pr where pr.id = target_request_id
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

create or replace function public.finish_trade(target_request_id uuid, completion_actor uuid, automatic boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target public.purchase_requests; target_book public.books; recipient uuid;
begin
  select * into target from public.purchase_requests where id = target_request_id for update;
  select * into target_book from public.books where id = target.book_id for update;
  if target.id is null or target.status <> 'awaiting_confirmation' then
    raise exception 'Order awaiting confirmation required';
  end if;
  update public.purchase_requests
  set status = 'completed', buyer_confirmed_at = now(), updated_at = now()
  where id = target.id;
  update public.books set status = 'sold', updated_at = now() where id = target.book_id;
  update public.purchase_requests set status = 'expired', updated_at = now()
  where book_id = target.book_id and id <> target.id
    and status in ('pending', 'waitlisted', 'reserved');
  update public.conversations
  set status = 'closed', closed_reason = 'book_sold', updated_at = now()
  where book_id = target.book_id and buyer_id <> target.buyer_id and status = 'active';
  insert into public.order_events (request_id, event_type, actor_id, details)
  values (
    target.id, case when automatic then 'auto_completed' else 'buyer_confirmed' end,
    completion_actor, jsonb_build_object('automatic', automatic)
  );
  for recipient in
    select distinct interested.user_id
    from (
      select buyer_id as user_id from public.conversations where book_id = target.book_id
      union select buyer_id from public.purchase_requests where book_id = target.book_id
      union select user_id from public.favorites where book_id = target.book_id
    ) interested
    where interested.user_id not in (target.buyer_id, target_book.seller_id)
  loop
    insert into public.notifications (
      recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
    ) values (
      recipient, target_book.seller_id, 'book_sold', target.book_id, target.id,
      '課本已售出', '《' || target_book.title || '》已售出',
      'book-sold:' || target.book_id::text || ':' || recipient::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end loop;
end;
$$;

create or replace function public.buyer_confirm_trade(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.purchase_requests
    where id = target_request_id and buyer_id = auth.uid() and status = 'awaiting_confirmation'
  ) then raise exception 'Buyer confirmation required'; end if;
  perform public.finish_trade(target_request_id, auth.uid(), false);
end;
$$;

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
      and created_at > reference_time - interval '72 hours' and reminded_at is null
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
    where status = 'pending' and created_at <= reference_time - interval '72 hours'
  loop
    update public.purchase_requests set status = 'expired', updated_at = reference_time where id = item.id;
    insert into public.notifications (
      recipient_id, type, book_id, request_id, title, message, dedupe_key
    ) values (
      item.buyer_id, 'order_expired', item.book_id, item.id, '購買請求已失效',
      '賣家在 72 小時內未處理，此次購買請求已自動失效',
      'order-expired-72:' || item.id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.order_events (request_id, event_type, dedupe_key)
    values (item.id, 'expired', 'order-expired-72:' || item.id::text)
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

drop policy if exists "Active buyers can create valid requests" on public.purchase_requests;
drop policy if exists "Buyers can create valid requests" on public.purchase_requests;
drop policy if exists "Buyers can cancel pending requests" on public.purchase_requests;
revoke insert, update, delete on public.purchase_requests from authenticated;
grant select on public.purchase_requests to authenticated;
create policy "Trading parties can read requests"
  on public.purchase_requests for select to authenticated
  using (
    auth.uid() = buyer_id
    or exists (
      select 1 from public.books
      where books.id = purchase_requests.book_id and books.seller_id = auth.uid()
    )
  );

create or replace function public.get_request_party_profiles()
returns table (id uuid, name text, department text)
language sql stable security definer set search_path = public
as $$
  select distinct p.id, p.name, p.department
  from public.profiles p
  where exists (
    select 1 from public.purchase_requests pr join public.books b on b.id = pr.book_id
    where auth.uid() in (pr.buyer_id, b.seller_id) and p.id in (pr.buyer_id, b.seller_id)
  ) or exists (
    select 1 from public.conversations c
    where auth.uid() in (c.buyer_id, c.seller_id) and p.id in (c.buyer_id, c.seller_id)
  )
  order by p.name;
$$;

create or replace function public.get_trade_contact(target_request_id uuid)
returns table (id uuid, name text, method text, value text, department text)
language plpgsql stable security definer set search_path = public
as $$
declare target public.purchase_requests; target_book public.books; preference public.book_contact_preferences;
begin
  select * into target from public.purchase_requests where purchase_requests.id = target_request_id;
  if target.id is null or target.status not in ('reserved', 'awaiting_confirmation', 'completed') then
    raise exception 'Selected transaction required';
  end if;
  select * into target_book from public.books where books.id = target.book_id;
  if auth.uid() = target_book.seller_id then return; end if;
  if auth.uid() <> target.buyer_id then raise exception 'Trading party permission required'; end if;
  select * into preference from public.book_contact_preferences where book_id = target_book.id;
  if preference.book_id is null or preference.method = 'none' then return; end if;
  return query select p.id, p.name, preference.method,
    case when preference.method = 'email' then p.email else preference.value end, p.department
  from public.profiles p where p.id = target_book.seller_id;
end;
$$;

drop trigger if exists purchase_request_created_notification on public.purchase_requests;
drop trigger if exists purchase_request_status_notification on public.purchase_requests;
drop trigger if exists trade_message_notification on public.trade_messages;

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_book public.books; buyer_name text;
begin
  select * into target_book from public.books where id = new.book_id;
  select name into buyer_name from public.profiles where id = new.buyer_id;
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key
  ) values (
    target_book.seller_id, new.buyer_id, 'request_created', new.book_id, new.id,
    '收到新的購買請求', coalesce(buyer_name, '一位買家') || '想購買《' || target_book.title || '》',
    'request-created:' || new.id::text
  ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
  return new;
end; $$;
create trigger purchase_request_created_notification
  after insert on public.purchase_requests for each row execute procedure public.notify_new_order();

create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare target public.conversations; recipient uuid; target_book public.books; sender_name text;
begin
  select * into target from public.conversations where id = new.conversation_id;
  select * into target_book from public.books where id = target.book_id;
  recipient := case when new.sender_id = target.buyer_id then target.seller_id else target.buyer_id end;
  select name into sender_name from public.profiles where id = new.sender_id;
  insert into public.notifications (
    recipient_id, actor_id, type, book_id, title, message
  ) values (
    recipient, new.sender_id, 'trade_message', target.book_id, '收到新的聊聊訊息',
    coalesce(sender_name, '對方') || '：' ||
      case when btrim(coalesce(new.body, '')) = '' then '傳送了圖片' else left(new.body, 80) end
  );
  return new;
end; $$;
create trigger trade_message_notification
  after insert on public.trade_messages for each row execute procedure public.notify_chat_message();

revoke execute on function public.start_conversation(uuid) from public, anon;
revoke execute on function public.list_my_conversations() from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.send_chat_message(uuid, text, text[]) from public, anon;
revoke execute on function public.recall_chat_message(uuid) from public, anon;
revoke execute on function public.close_conversation(uuid, text) from public, anon;
revoke execute on function public.set_user_block(uuid, boolean) from public, anon;
revoke execute on function public.submit_chat_report(uuid, uuid, text, text) from public, anon;
revoke execute on function public.create_purchase_request(uuid, text) from public, anon;
revoke execute on function public.respond_to_purchase_request(uuid, text) from public, anon;
revoke execute on function public.cancel_purchase_request(uuid, text) from public, anon;
revoke execute on function public.seller_confirm_handoff(uuid) from public, anon;
revoke execute on function public.buyer_confirm_trade(uuid) from public, anon;
revoke execute on function public.finish_trade(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.process_trade_deadlines(timestamptz) from public, anon, authenticated;

grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.list_my_conversations() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text, text[]) to authenticated;
grant execute on function public.recall_chat_message(uuid) to authenticated;
grant execute on function public.close_conversation(uuid, text) to authenticated;
grant execute on function public.set_user_block(uuid, boolean) to authenticated;
grant execute on function public.submit_chat_report(uuid, uuid, text, text) to authenticated;
grant execute on function public.create_purchase_request(uuid, text) to authenticated;
grant execute on function public.respond_to_purchase_request(uuid, text) to authenticated;
grant execute on function public.cancel_purchase_request(uuid, text) to authenticated;
grant execute on function public.seller_confirm_handoff(uuid) to authenticated;
grant execute on function public.buyer_confirm_trade(uuid) to authenticated;
grant execute on function public.finish_trade(uuid, uuid, boolean) to service_role;
grant execute on function public.process_trade_deadlines(timestamptz) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end $$;

create extension if not exists pg_cron;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'process-trade-deadlines-hourly';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'process-trade-deadlines-hourly',
    '17 * * * *',
    'select public.process_trade_deadlines(now());'
  );
end $$;
