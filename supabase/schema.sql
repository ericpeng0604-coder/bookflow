-- Run this file in the Supabase SQL editor.
create extension if not exists "pgcrypto";

create type public.book_status as enum ('available', 'negotiating', 'sold');
create type public.request_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  email text not null,
  department text not null,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  author text not null,
  department text not null default '',
  course text not null default '',
  teacher text not null default '',
  edition text not null default '',
  condition text not null,
  price integer not null check (price >= 0),
  image_url text not null default '',
  meetup text not null,
  description text not null default '',
  status public.book_status not null default 'available',
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (book_id, buyer_id)
);

create index books_search_idx on public.books using gin (
  to_tsvector('simple', title || ' ' || author || ' ' || course || ' ' || teacher)
);
create index books_department_status_idx on public.books (department, status, created_at desc);
create index requests_book_idx on public.purchase_requests (book_id, status);
create index requests_buyer_idx on public.purchase_requests (buyer_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.purchase_requests enable row level security;

create policy "Profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Books are publicly readable"
  on public.books for select using (true);
create policy "Users can create their own listings"
  on public.books for insert to authenticated with check (auth.uid() = seller_id);
create policy "Sellers can update their own listings"
  on public.books for update to authenticated using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "Sellers can delete their own listings"
  on public.books for delete to authenticated using (auth.uid() = seller_id);

create policy "Trading parties can read requests"
  on public.purchase_requests for select to authenticated
  using (
    auth.uid() = buyer_id or exists (
      select 1 from public.books where books.id = book_id and books.seller_id = auth.uid()
    )
  );
create policy "Buyers can create valid requests"
  on public.purchase_requests for insert to authenticated
  with check (
    auth.uid() = buyer_id and exists (
      select 1 from public.books
      where books.id = book_id and books.seller_id <> auth.uid() and books.status = 'available'
    )
  );
create policy "Buyers can cancel pending requests"
  on public.purchase_requests for update to authenticated
  using (auth.uid() = buyer_id and status = 'pending')
  with check (auth.uid() = buyer_id and status = 'cancelled');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'department', '未設定')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- A security-definer function makes acceptance atomic: it updates the book and
-- rejects competing requests in one transaction.
create or replace function public.respond_to_purchase_request(
  request_id uuid,
  response public.request_status
) returns void language plpgsql security definer set search_path = public as $$
declare
  target public.purchase_requests;
  owner_id uuid;
begin
  if response not in ('accepted', 'rejected') then
    raise exception 'Invalid response';
  end if;

  select * into target from public.purchase_requests where id = request_id for update;
  select seller_id into owner_id from public.books where id = target.book_id for update;

  if owner_id <> auth.uid() then
    raise exception 'Only the seller can respond';
  end if;

  update public.purchase_requests set status = response where id = request_id;

  if response = 'accepted' then
    update public.books set status = 'negotiating', updated_at = now() where id = target.book_id;
    update public.purchase_requests
      set status = 'rejected'
      where book_id = target.book_id and id <> request_id and status = 'pending';
  end if;
end;
$$;

grant execute on function public.respond_to_purchase_request(uuid, public.request_status) to authenticated;
revoke execute on function public.respond_to_purchase_request(uuid, public.request_status) from public, anon;

insert into storage.buckets (id, name, public)
values ('book-images', 'book-images', true)
on conflict (id) do nothing;

create policy "Book images are publicly readable"
  on storage.objects for select using (bucket_id = 'book-images');
create policy "Users can upload book images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update their book images"
  on storage.objects for update to authenticated
  using (bucket_id = 'book-images' and owner_id = auth.uid()::text);
create policy "Users can delete their book images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'book-images' and owner_id = auth.uid()::text);
