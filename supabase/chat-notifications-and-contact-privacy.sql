-- Run after reports-and-suspensions.sql, list-books-pagination.sql,
-- and trade-messages.sql.
-- Adds chat notifications and seller-controlled post-acceptance contact sharing.

create table if not exists public.book_contact_preferences (
  book_id uuid primary key references public.books(id) on delete cascade,
  method text not null default 'none' check (method in ('none', 'email', 'line')),
  value text not null default '',
  updated_at timestamptz not null default now(),
  check (
    (method <> 'line' and value = '')
    or (method = 'line' and char_length(btrim(value)) between 1 and 100)
  )
);

alter table public.book_contact_preferences enable row level security;

drop policy if exists "Sellers read contact preferences" on public.book_contact_preferences;
drop policy if exists "Sellers create contact preferences" on public.book_contact_preferences;
drop policy if exists "Sellers update contact preferences" on public.book_contact_preferences;
drop policy if exists "Sellers delete contact preferences" on public.book_contact_preferences;

create policy "Sellers read contact preferences"
  on public.book_contact_preferences for select to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = book_contact_preferences.book_id
        and books.seller_id = auth.uid()
    )
  );

create policy "Sellers create contact preferences"
  on public.book_contact_preferences for insert to authenticated
  with check (
    exists (
      select 1 from public.books
      where books.id = book_contact_preferences.book_id
        and books.seller_id = auth.uid()
    )
  );

create policy "Sellers update contact preferences"
  on public.book_contact_preferences for update to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = book_contact_preferences.book_id
        and books.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.books
      where books.id = book_contact_preferences.book_id
        and books.seller_id = auth.uid()
    )
  );

create policy "Sellers delete contact preferences"
  on public.book_contact_preferences for delete to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = book_contact_preferences.book_id
        and books.seller_id = auth.uid()
    )
  );

revoke all on table public.book_contact_preferences from anon, authenticated;
grant select, insert, update, delete on table public.book_contact_preferences to authenticated;

drop function if exists public.get_trade_contacts_batch(uuid[]);
drop function if exists public.get_trade_contact(uuid);

create function public.get_trade_contact(target_request_id uuid)
returns table (
  id uuid,
  name text,
  method text,
  value text,
  department text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target public.purchase_requests;
  target_book public.books;
  preference public.book_contact_preferences;
begin
  select * into target
  from public.purchase_requests
  where purchase_requests.id = target_request_id;

  if target.id is null or target.status <> 'accepted' then
    raise exception 'Accepted transaction required';
  end if;

  select * into target_book
  from public.books
  where books.id = target.book_id;

  if auth.uid() = target_book.seller_id then
    return;
  end if;
  if auth.uid() <> target.buyer_id then
    raise exception 'Trading party permission required';
  end if;

  select * into preference
  from public.book_contact_preferences
  where book_id = target_book.id;

  if preference.book_id is null or preference.method = 'none' then
    return;
  end if;

  return query
    select
      profiles.id,
      profiles.name,
      preference.method,
      case when preference.method = 'email' then profiles.email else preference.value end,
      profiles.department
    from public.profiles
    where profiles.id = target_book.seller_id;
end;
$$;

revoke execute on function public.get_trade_contact(uuid) from public, anon;
grant execute on function public.get_trade_contact(uuid) to authenticated;

create function public.get_trade_contacts_batch(p_request_ids uuid[])
returns table (
  request_id uuid,
  id uuid,
  name text,
  method text,
  value text,
  department text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_request_id uuid;
begin
  if p_request_ids is null or array_length(p_request_ids, 1) is null then
    return;
  end if;

  foreach target_request_id in array p_request_ids loop
    return query
    select
      target_request_id,
      contact.id,
      contact.name,
      contact.method,
      contact.value,
      contact.department
    from public.get_trade_contact(target_request_id) as contact;
  end loop;
end;
$$;

revoke execute on function public.get_trade_contacts_batch(uuid[]) from public, anon;
grant execute on function public.get_trade_contacts_batch(uuid[]) to authenticated;

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
      'trade_message'
    )
  );

create or replace function public.notify_trade_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.purchase_requests;
  target_book public.books;
  recipient_id uuid;
  sender_name text;
begin
  select * into target_request
  from public.purchase_requests
  where id = new.request_id;

  select * into target_book
  from public.books
  where id = target_request.book_id;

  recipient_id := case
    when new.sender_id = target_request.buyer_id then target_book.seller_id
    else target_request.buyer_id
  end;

  select name into sender_name
  from public.profiles
  where id = new.sender_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    book_id,
    request_id,
    title,
    message
  ) values (
    recipient_id,
    new.sender_id,
    'trade_message',
    target_book.id,
    target_request.id,
    '新的聊天訊息',
    coalesce(sender_name, '交易對象') || '：' || left(new.body, 80)
  );

  return new;
end;
$$;

revoke execute on function public.notify_trade_message() from public, anon, authenticated;

drop trigger if exists trade_message_notification on public.trade_messages;
create trigger trade_message_notification
  after insert on public.trade_messages
  for each row execute procedure public.notify_trade_message();
