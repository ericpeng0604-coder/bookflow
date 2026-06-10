-- Run after schema.sql and moderation.sql.
-- This migration is idempotent and adds shared transactions, private contacts,
-- in-app notifications, and privacy-safe profile access.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (
    type in (
      'request_created',
      'request_accepted',
      'request_rejected',
      'trade_completed',
      'book_approved',
      'book_rejected'
    )
  ),
  book_id uuid references public.books(id) on delete cascade,
  request_id uuid references public.purchase_requests(id) on delete cascade,
  title text not null,
  message text not null default '',
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications disable row level security;

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users read their own notifications" on public.notifications;
drop policy if exists "Users mark their own notifications read" on public.notifications;

create policy "Users read their own notifications"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

create policy "Users mark their own notifications read"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke insert, delete on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- Replace the old one-request-ever constraint with one active request at a time.
alter table public.purchase_requests
  drop constraint if exists purchase_requests_book_id_buyer_id_key;

create unique index if not exists purchase_requests_one_active_per_buyer
  on public.purchase_requests (book_id, buyer_id)
  where status in ('pending', 'accepted');

drop policy if exists "Trading parties can read requests" on public.purchase_requests;
drop policy if exists "Buyers can create valid requests" on public.purchase_requests;
drop policy if exists "Buyers can cancel pending requests" on public.purchase_requests;

create policy "Trading parties can read requests"
  on public.purchase_requests for select to authenticated
  using (
    auth.uid() = buyer_id
    or exists (
      select 1
      from public.books
      where books.id = purchase_requests.book_id
        and books.seller_id = auth.uid()
    )
  );

create policy "Buyers can create valid requests"
  on public.purchase_requests for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1
      from public.books
      where books.id = purchase_requests.book_id
        and books.seller_id <> auth.uid()
        and books.status = 'available'
        and books.review_status = 'approved'
    )
  );

create policy "Buyers can cancel pending requests"
  on public.purchase_requests for update to authenticated
  using (auth.uid() = buyer_id and status = 'pending')
  with check (auth.uid() = buyer_id and status = 'cancelled');

-- Full profiles are private. Public display data and admin data use dedicated RPCs.
drop policy if exists "Profiles are readable by signed-in users" on public.profiles;
drop policy if exists "Users read their own profile" on public.profiles;

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- Sellers can edit listing content, but status and moderation fields use RPCs.
revoke update on table public.books from authenticated;
grant update (
  title,
  author,
  department,
  course,
  teacher,
  edition,
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
    new.title,
    new.author,
    new.department,
    new.course,
    new.teacher,
    new.edition,
    new.condition,
    new.price,
    new.image_url,
    new.meetup,
    new.description
  ) is distinct from (
    old.title,
    old.author,
    old.department,
    old.course,
    old.teacher,
    old.edition,
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

revoke execute on function public.enforce_book_review() from public, anon, authenticated;

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
  where exists (
    select 1 from public.books where books.seller_id = profiles.id
  )
  order by profiles.name;
$$;

revoke execute on function public.get_public_profiles() from public;
grant execute on function public.get_public_profiles() to anon, authenticated;

create or replace function public.get_request_party_profiles()
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
  select distinct profiles.id, profiles.name, profiles.department
  from public.profiles
  where exists (
    select 1
    from public.purchase_requests
    join public.books on books.id = purchase_requests.book_id
    where (
      purchase_requests.buyer_id = auth.uid()
      or books.seller_id = auth.uid()
    )
    and profiles.id in (purchase_requests.buyer_id, books.seller_id)
  )
  order by profiles.name;
$$;

revoke execute on function public.get_request_party_profiles() from public, anon;
grant execute on function public.get_request_party_profiles() to authenticated;

create or replace function public.list_profiles_for_admin()
returns table (
  id uuid,
  name text,
  email text,
  department text,
  role text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'Admin permission required';
  end if;

  return query
    select profiles.id, profiles.name, profiles.email, profiles.department, profiles.role
    from public.profiles
    order by profiles.created_at;
end;
$$;

revoke execute on function public.list_profiles_for_admin() from public, anon;
grant execute on function public.list_profiles_for_admin() to authenticated;

create or replace function public.get_trade_contact(target_request_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  department text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target public.purchase_requests;
  seller_id uuid;
  contact_id uuid;
begin
  select * into target
  from public.purchase_requests
  where purchase_requests.id = target_request_id;

  if target.id is null or target.status <> 'accepted' then
    raise exception 'Accepted transaction required';
  end if;

  select books.seller_id into seller_id
  from public.books
  where books.id = target.book_id;

  if auth.uid() = target.buyer_id then
    contact_id := seller_id;
  elsif auth.uid() = seller_id then
    contact_id := target.buyer_id;
  else
    raise exception 'Trading party permission required';
  end if;

  return query
    select profiles.id, profiles.name, profiles.email, profiles.department
    from public.profiles
    where profiles.id = contact_id;
end;
$$;

revoke execute on function public.get_trade_contact(uuid) from public, anon;
grant execute on function public.get_trade_contact(uuid) to authenticated;

create or replace function public.notify_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_book public.books;
  buyer_name text;
begin
  select * into target_book from public.books where id = new.book_id;
  select name into buyer_name from public.profiles where id = new.buyer_id;

  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message
  ) values (
    target_book.seller_id,
    new.buyer_id,
    'request_created',
    new.book_id,
    new.id,
    '收到新的購買意願',
    coalesce(buyer_name, '一位買家') || '想購買《' || target_book.title || '》'
  );
  return new;
end;
$$;

revoke execute on function public.notify_request_created() from public, anon, authenticated;

drop trigger if exists purchase_request_created_notification on public.purchase_requests;
create trigger purchase_request_created_notification
  after insert on public.purchase_requests
  for each row execute procedure public.notify_request_created();

create or replace function public.notify_request_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_book public.books;
  notification_type text;
  notification_title text;
  notification_message text;
begin
  if old.status = new.status or new.status not in ('accepted', 'rejected') then
    return new;
  end if;

  select * into target_book from public.books where id = new.book_id;
  notification_type := case when new.status = 'accepted'
    then 'request_accepted' else 'request_rejected' end;
  notification_title := case when new.status = 'accepted'
    then '購買意願已接受' else '購買意願未被接受' end;
  notification_message := case when new.status = 'accepted'
    then '賣家已接受你對《' || target_book.title || '》的購買意願'
    else '你對《' || target_book.title || '》的購買意願已結束'
  end;

  insert into public.notifications (
    recipient_id, actor_id, type, book_id, request_id, title, message
  ) values (
    new.buyer_id,
    target_book.seller_id,
    notification_type,
    new.book_id,
    new.id,
    notification_title,
    notification_message
  );
  return new;
end;
$$;

revoke execute on function public.notify_request_status_changed() from public, anon, authenticated;

drop trigger if exists purchase_request_status_notification on public.purchase_requests;
create trigger purchase_request_status_notification
  after update of status on public.purchase_requests
  for each row execute procedure public.notify_request_status_changed();

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
  for update;

  if owner_id <> auth.uid() then
    raise exception 'Only the seller can respond';
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
  select * into target_book
  from public.books
  where id = target_book_id
  for update;

  if target_book.id is null
    or target_book.seller_id <> auth.uid()
    or target_book.status <> 'negotiating' then
    raise exception 'Seller with negotiating book required';
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

create or replace function public.notify_book_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.review_status = new.review_status
    or new.review_status not in ('approved', 'rejected') then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, type, book_id, title, message
  ) values (
    new.seller_id,
    new.reviewed_by,
    case when new.review_status = 'approved'
      then 'book_approved' else 'book_rejected' end,
    new.id,
    case when new.review_status = 'approved'
      then '刊登審核通過' else '刊登需要修改' end,
    case when new.review_status = 'approved'
      then '《' || new.title || '》已公開上架'
      else '《' || new.title || '》未通過審核：' || coalesce(new.review_note, '')
    end
  );
  return new;
end;
$$;

revoke execute on function public.notify_book_reviewed() from public, anon, authenticated;

drop trigger if exists book_review_notification on public.books;
create trigger book_review_notification
  after update of review_status on public.books
  for each row execute procedure public.notify_book_reviewed();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
