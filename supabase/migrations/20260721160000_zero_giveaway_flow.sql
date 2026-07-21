-- Zero-price giveaway flow. Keep it separate from purchase-request RPCs because
-- giveaway applicants remain candidates until the giver explicitly selects one.

alter table public.books drop constraint if exists books_listing_type_check;
alter table public.books drop constraint if exists books_price_upper_check;
alter table public.books
  add constraint books_listing_type_check check (listing_type in ('book', 'secondhand', 'giveaway')) not valid,
  add constraint books_price_upper_check check (price between 0 and 1000000) not valid,
  add constraint books_giveaway_price_check check (listing_type <> 'giveaway' or price = 0) not valid;

alter table public.purchase_requests drop constraint if exists purchase_requests_status_check;
alter table public.purchase_requests
  add constraint purchase_requests_status_check check (
    status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation', 'reserved',
      'awaiting_confirmation', 'completed', 'rejected', 'cancelled', 'expired')
  ) not valid;

create index if not exists purchase_requests_giveaway_active_idx
  on public.purchase_requests (book_id, status, created_at)
  where status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation', 'reserved', 'awaiting_confirmation');

create or replace function public.create_giveaway_request(
  target_book_id uuid,
  request_message text default '',
  preferred_location text default '',
  preferred_time text default ''
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare target_book public.books; existing_request public.purchase_requests; created_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Active account required'; end if;
  select * into target_book from public.books where id = target_book_id for update;
  if target_book.id is null or target_book.seller_id = auth.uid()
    or target_book.listing_type <> 'giveaway' or target_book.price <> 0
    or target_book.lifecycle_state <> 'active'
    or target_book.review_status <> 'approved' or target_book.moderation_visibility <> 'visible'
    or target_book.status <> 'available' then
    raise exception 'Giveaway is not accepting applications';
  end if;

  select * into existing_request from public.purchase_requests
  where book_id = target_book_id and buyer_id = auth.uid()
    and status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation', 'reserved', 'awaiting_confirmation')
  for update;
  if existing_request.id is not null then
    if existing_request.status = 'awaiting_recipient_confirmation' then
      raise exception 'Recipient confirmation is pending';
    end if;
    update public.purchase_requests
    set message = left(coalesce(request_message, ''), 500),
        preferred_meetup_location = left(coalesce(preferred_location, ''), 160),
        preferred_meetup_time = left(coalesce(preferred_time, ''), 160),
        updated_at = now()
    where id = existing_request.id;
    insert into public.order_events (request_id, event_type, actor_id)
    values (existing_request.id, 'giveaway_application_updated', auth.uid());
    insert into public.notifications (recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key)
    values (target_book.seller_id, auth.uid(), 'request_created', target_book.id, existing_request.id,
      '零元贈送申請已更新', '有人更新了「' || target_book.title || '」的領取訊息。',
      'giveaway-application-updated:' || existing_request.id::text || ':' || extract(epoch from now())::bigint)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    return existing_request.id;
  end if;

  insert into public.purchase_requests (
    book_id, buyer_id, message, preferred_meetup_location, preferred_meetup_time,
    status, title_snapshot, price_snapshot, edition_snapshot, image_snapshot, meetup_snapshot
  ) values (
    target_book.id, auth.uid(), left(coalesce(request_message, ''), 500),
    left(coalesce(preferred_location, ''), 160), left(coalesce(preferred_time, ''), 160),
    'pending', target_book.title, 0, target_book.edition, target_book.image_url, target_book.meetup
  ) returning id into created_id;
  insert into public.order_events (request_id, event_type, actor_id)
    values (created_id, 'giveaway_application_created', auth.uid());
  perform public.open_order_conversation(created_id);
  return created_id;
end;
$$;

create or replace function public.select_giveaway_recipient(target_request_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare target public.purchase_requests; target_book public.books; expires_at timestamptz;
begin
  select * into target from public.purchase_requests where id = target_request_id for update;
  select * into target_book from public.books where id = target.book_id for update;
  if target.id is null or target_book.listing_type <> 'giveaway' or target_book.seller_id <> auth.uid()
    or target.status not in ('pending', 'waitlisted') or target_book.status <> 'available' then
    raise exception 'Giveaway candidate selection required';
  end if;
  expires_at := now() + interval '24 hours';
  update public.purchase_requests set status = 'waitlisted', updated_at = now()
    where book_id = target.book_id and id <> target.id and status = 'pending';
  update public.purchase_requests
    set status = 'awaiting_recipient_confirmation', reservation_expires_at = expires_at, updated_at = now()
    where id = target.id;
  update public.books set status = 'negotiating', updated_at = now() where id = target.book_id;
  insert into public.order_events (request_id, event_type, actor_id, details)
    values (target.id, 'giveaway_recipient_selected', auth.uid(), jsonb_build_object('expires_at', expires_at));
  insert into public.notifications (recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key)
    values (target.buyer_id, auth.uid(), 'request_accepted', target.book_id, target.id,
      '你已被選為零元贈送受贈者', '請在 24 小時內確認是否接受「' || target.title_snapshot || '」。',
      'giveaway-selected:' || target.id::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

create or replace function public.respond_to_giveaway_recipient(target_request_id uuid, response text)
returns void
language plpgsql security definer set search_path = public
as $$
declare target public.purchase_requests; target_book public.books;
begin
  if response not in ('accepted', 'declined') then raise exception 'Invalid giveaway response'; end if;
  select * into target from public.purchase_requests where id = target_request_id for update;
  select * into target_book from public.books where id = target.book_id for update;
  if target.id is null or target_book.listing_type <> 'giveaway'
    or target.buyer_id <> auth.uid() or target.status <> 'awaiting_recipient_confirmation' then
    raise exception 'Recipient confirmation required';
  end if;
  if response = 'accepted' then
    update public.purchase_requests set status = 'reserved', updated_at = now() where id = target.id;
    insert into public.order_events (request_id, event_type, actor_id) values (target.id, 'giveaway_accepted', auth.uid());
    insert into public.notifications (recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key)
      values (target_book.seller_id, auth.uid(), 'request_accepted', target.book_id, target.id,
        '受贈者已接受贈送', '「' || target.title_snapshot || '」已保留，請在聊天室確認面交。',
        'giveaway-accepted:' || target.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
  else
    update public.purchase_requests set status = 'rejected', cancelled_at = now(), cancellation_reason = 'recipient_declined', updated_at = now()
      where id = target.id;
    update public.books set status = 'available', updated_at = now() where id = target.book_id;
    update public.purchase_requests set status = 'pending', updated_at = now()
      where book_id = target.book_id and status = 'waitlisted';
    insert into public.order_events (request_id, event_type, actor_id) values (target.id, 'giveaway_declined', auth.uid());
    insert into public.notifications (recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key)
      values (target_book.seller_id, auth.uid(), 'request_rejected', target.book_id, target.id,
        '受贈者無法領取', '你可以回到申請名單改選其他候補。', 'giveaway-declined:' || target.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
end;
$$;

create or replace function public.reselect_giveaway_recipient(old_request_id uuid, new_request_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare old_request public.purchase_requests; new_request public.purchase_requests; target_book public.books; expires_at timestamptz;
begin
  select * into old_request from public.purchase_requests where id = old_request_id for update;
  select * into new_request from public.purchase_requests where id = new_request_id for update;
  select * into target_book from public.books where id = old_request.book_id for update;
  if old_request.id is null or new_request.id is null or old_request.book_id <> new_request.book_id
    or target_book.listing_type <> 'giveaway' or target_book.seller_id <> auth.uid()
    or old_request.status <> 'awaiting_recipient_confirmation'
    or new_request.status not in ('pending', 'waitlisted') then
    raise exception 'Giveaway reselection required';
  end if;
  expires_at := now() + interval '24 hours';
  update public.purchase_requests set status = 'expired', cancelled_at = now(), cancellation_reason = 'giver_reselected', updated_at = now()
    where id = old_request.id;
  update public.purchase_requests set status = 'waitlisted', updated_at = now()
    where book_id = new_request.book_id and id not in (old_request.id, new_request.id) and status = 'pending';
  update public.purchase_requests set status = 'awaiting_recipient_confirmation', reservation_expires_at = expires_at, updated_at = now()
    where id = new_request.id;
  update public.books set status = 'negotiating', updated_at = now() where id = target_book.id;
  insert into public.order_events (request_id, event_type, actor_id, details)
    values (old_request.id, 'giveaway_reselected', auth.uid(), jsonb_build_object('new_request_id', new_request.id));
  insert into public.notifications (recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key)
    values (new_request.buyer_id, auth.uid(), 'request_accepted', target_book.id, new_request.id,
      '你已被選為零元贈送受贈者', '請在 24 小時內確認是否接受「' || target_book.title || '」。',
      'giveaway-reselected:' || new_request.id::text || ':' || old_request.id::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

create or replace function public.cancel_giveaway_listing(target_book_id uuid, p_cancellation_reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_book public.books; item record;
begin
  if char_length(btrim(coalesce(p_cancellation_reason, ''))) < 2 then raise exception 'Cancellation reason required'; end if;
  select * into target_book from public.books where id = target_book_id for update;
  if target_book.id is null or target_book.listing_type <> 'giveaway' or target_book.seller_id <> auth.uid() then
    raise exception 'Giveaway owner required';
  end if;
  update public.books set lifecycle_state = 'withdrawn', updated_at = now() where id = target_book.id;
  for item in select * from public.purchase_requests where book_id = target_book.id
    and status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation', 'reserved', 'awaiting_confirmation') loop
    update public.purchase_requests set status = 'cancelled', cancelled_at = now(),
      cancellation_reason = left(btrim(p_cancellation_reason), 500), updated_at = now() where id = item.id;
    insert into public.order_events (request_id, event_type, actor_id, details)
      values (item.id, 'giveaway_cancelled', auth.uid(), jsonb_build_object('reason', left(btrim(p_cancellation_reason), 500)));
    insert into public.notifications (recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key)
      values (item.buyer_id, auth.uid(), 'reservation_cancelled', target_book.id, item.id, '零元贈送已取消',
        '贈送者取消了「' || target_book.title || '」，原因：' || left(btrim(p_cancellation_reason), 200),
        'giveaway-cancelled:' || item.id::text || ':' || extract(epoch from now())::bigint)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end loop;
end;
$$;

create or replace function public.giveaway_confirm_handoff(target_request_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare target public.purchase_requests; target_book public.books; first_confirmed timestamptz;
begin
  select pr.* into target from public.purchase_requests pr where pr.id = target_request_id for update;
  select b.* into target_book from public.books b where b.id = target.book_id for update;
  if target.id is null or target_book.listing_type <> 'giveaway'
    or auth.uid() not in (target_book.seller_id, target.buyer_id)
    or target.status not in ('reserved', 'awaiting_confirmation') then
    raise exception 'Reserved giveaway confirmation required';
  end if;
  if auth.uid() = target_book.seller_id then
    update public.purchase_requests set seller_handoff_at = coalesce(seller_handoff_at, now()), updated_at = now() where id = target.id;
  else
    update public.purchase_requests set buyer_confirmed_at = coalesce(buyer_confirmed_at, now()), updated_at = now() where id = target.id;
  end if;
  select least(seller_handoff_at, buyer_confirmed_at) into first_confirmed from public.purchase_requests where id = target.id;
  if target.seller_handoff_at is not null or target.buyer_confirmed_at is not null then
    update public.purchase_requests set status = 'awaiting_confirmation' where id = target.id and status = 'reserved';
  end if;
  if exists (select 1 from public.purchase_requests where id = target.id and seller_handoff_at is not null and buyer_confirmed_at is not null) then
    update public.purchase_requests set status = 'completed', updated_at = now() where id = target.id;
    update public.books set status = 'sold', updated_at = now() where id = target.book_id;
    insert into public.order_events (request_id, event_type, actor_id) values (target.id, 'giveaway_completed', auth.uid());
  else
    insert into public.order_events (request_id, event_type, actor_id) values (target.id, 'giveaway_handoff_confirmed', auth.uid());
    insert into public.notifications (recipient_id, actor_id, type, book_id, request_id, title, message, dedupe_key)
      values (case when auth.uid() = target.buyer_id then target_book.seller_id else target.buyer_id end,
        auth.uid(), 'handoff_confirmation', target.book_id, target.id, '請確認零元贈送是否完成',
        '對方已確認面交，請登入完成雙方確認。', 'giveaway-handoff:' || target.id::text || ':' || auth.uid()::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
end;
$$;

create or replace function public.process_giveaway_deadlines(reference_time timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare item record; reminders int := 0; admin_cases int := 0;
begin
  for item in
    select pr.*, b.seller_id, b.title from public.purchase_requests pr join public.books b on b.id = pr.book_id
    where b.listing_type = 'giveaway' and pr.status = 'awaiting_recipient_confirmation'
      and pr.reservation_expires_at <= reference_time
      and not exists (select 1 from public.order_events e where e.request_id = pr.id and e.event_type = 'giveaway_timeout_reminder')
  loop
    insert into public.notifications (recipient_id, type, book_id, request_id, title, message, dedupe_key)
      values (item.seller_id, 'order_reminder', item.book_id, item.id, '零元贈送受贈者尚未確認',
        '受贈者已超過 24 小時未確認。你可以繼續等待，或改選其他申請者。', 'giveaway-timeout:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.order_events (request_id, event_type, dedupe_key)
      values (item.id, 'giveaway_timeout_reminder', 'giveaway-timeout:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    reminders := reminders + 1;
  end loop;
  for item in
    select pr.*, b.seller_id, b.title from public.purchase_requests pr join public.books b on b.id = pr.book_id
    where b.listing_type = 'giveaway' and pr.status = 'awaiting_confirmation'
      and greatest(pr.seller_handoff_at, pr.buyer_confirmed_at) <= reference_time - interval '3 days'
      and not exists (select 1 from public.order_events e where e.request_id = pr.id and e.event_type = 'giveaway_admin_intervention')
  loop
    insert into public.notifications (recipient_id, type, book_id, request_id, title, message, dedupe_key)
      values (item.seller_id, 'handoff_confirmation', item.book_id, item.id, '零元贈送需要管理員介入',
        '雙方完成確認已等待超過 3 天，案件已建立待處理提醒。', 'giveaway-admin:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.order_events (request_id, event_type, dedupe_key)
      values (item.id, 'giveaway_admin_intervention', 'giveaway-admin:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    admin_cases := admin_cases + 1;
  end loop;
  return jsonb_build_object('recipient_reminders', reminders, 'admin_cases', admin_cases);
end;
$$;

create or replace function public.notify_giveaway_listing_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare item record;
begin
  if new.listing_type <> 'giveaway' or (
    old.title = new.title and old.description = new.description and old.meetup = new.meetup
    and old.condition = new.condition and old.image_url = new.image_url and old.image_urls = new.image_urls
  ) then return new; end if;
  for item in select distinct buyer_id from public.purchase_requests
    where book_id = new.id and status in ('pending', 'waitlisted', 'awaiting_recipient_confirmation', 'reserved', 'awaiting_confirmation') loop
    insert into public.notifications (recipient_id, actor_id, type, book_id, title, message, dedupe_key)
      values (item.buyer_id, new.seller_id, 'listing_lifecycle', new.id, '零元贈送內容已更新',
        '「' || new.title || '」的刊登內容已更新，請重新確認領取安排。',
        'giveaway-listing-updated:' || new.id::text || ':' || extract(epoch from now())::bigint)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists giveaway_listing_update_notification on public.books;
create trigger giveaway_listing_update_notification
  after update on public.books for each row execute procedure public.notify_giveaway_listing_update();

-- Legacy deadline processing must not expire or auto-complete giveaways.
create or replace function public.process_trade_deadlines(reference_time timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public
as $$
declare item record; reminded int := 0; expired int := 0; released int := 0; completed int := 0;
begin
  for item in select pr.* from public.purchase_requests pr join public.books b on b.id = pr.book_id
    where b.listing_type <> 'giveaway' and pr.status = 'pending' and pr.created_at <= reference_time - interval '24 hours'
      and pr.created_at > reference_time - interval '7 days' and pr.reminded_at is null loop
    update public.purchase_requests set reminded_at = reference_time where id = item.id;
    insert into public.notifications (recipient_id, type, book_id, request_id, title, message, dedupe_key)
      select b.seller_id, 'order_reminder', b.id, item.id, '購買意願提醒', '這筆購買意願已等待超過 24 小時。', 'order-reminder-24:' || item.id::text
      from public.books b where b.id = item.book_id
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.order_events (request_id, event_type, dedupe_key)
      values (item.id, 'seller_reminded', 'order-reminder-24:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    reminded := reminded + 1;
  end loop;
  for item in select pr.* from public.purchase_requests pr join public.books b on b.id = pr.book_id
    where b.listing_type <> 'giveaway' and pr.status = 'pending' and pr.created_at <= reference_time - interval '7 days' loop
    update public.purchase_requests set status = 'expired', updated_at = reference_time where id = item.id;
    insert into public.notifications (recipient_id, type, book_id, request_id, title, message, dedupe_key)
      values (item.buyer_id, 'order_expired', item.book_id, item.id, '購買意願已失效', '這筆購買意願已超過等待期限。', 'order-expired-7d:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    insert into public.order_events (request_id, event_type, dedupe_key)
      values (item.id, 'expired', 'order-expired-7d:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    expired := expired + 1;
  end loop;
  for item in select pr.* from public.purchase_requests pr join public.books b on b.id = pr.book_id
    where b.listing_type <> 'giveaway' and pr.status = 'reserved' and pr.reservation_expires_at <= reference_time loop
    update public.purchase_requests set status = 'expired', updated_at = reference_time, cancellation_reason = 'reservation_timeout' where id = item.id;
    update public.books set status = 'available', updated_at = reference_time where id = item.book_id;
    update public.purchase_requests set status = 'pending', updated_at = reference_time where book_id = item.book_id and status = 'waitlisted';
    insert into public.order_events (request_id, event_type, dedupe_key)
      values (item.id, 'reservation_expired', 'reservation-expired:' || item.id::text)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    released := released + 1;
  end loop;
  for item in select pr.* from public.purchase_requests pr join public.books b on b.id = pr.book_id
    where b.listing_type <> 'giveaway' and pr.status = 'awaiting_confirmation'
      and pr.seller_handoff_at <= reference_time - interval '48 hours' loop
    perform public.finish_trade(item.id, null, true);
    completed := completed + 1;
  end loop;
  return jsonb_build_object('reminded', reminded, 'expired', expired, 'released', released, 'completed', completed);
end;
$$;

revoke all on function public.create_giveaway_request(uuid, text, text, text) from public, anon;
revoke all on function public.select_giveaway_recipient(uuid) from public, anon;
revoke all on function public.respond_to_giveaway_recipient(uuid, text) from public, anon;
revoke all on function public.reselect_giveaway_recipient(uuid, uuid) from public, anon;
revoke all on function public.giveaway_confirm_handoff(uuid) from public, anon;
revoke all on function public.process_giveaway_deadlines(timestamptz) from public, anon, authenticated;
grant execute on function public.create_giveaway_request(uuid, text, text, text) to authenticated;
grant execute on function public.select_giveaway_recipient(uuid) to authenticated;
grant execute on function public.respond_to_giveaway_recipient(uuid, text) to authenticated;
grant execute on function public.reselect_giveaway_recipient(uuid, uuid) to authenticated;
grant execute on function public.cancel_giveaway_listing(uuid, text) to authenticated;
grant execute on function public.giveaway_confirm_handoff(uuid) to authenticated;
grant execute on function public.process_giveaway_deadlines(timestamptz) to service_role;
