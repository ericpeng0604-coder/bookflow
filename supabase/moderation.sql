-- Run this migration once in the Supabase SQL editor after schema.sql.
-- It adds shared listings, moderation roles, and secure review actions.

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'moderator', 'admin'));

-- Users may edit display fields only. Role changes must go through set_user_role().
revoke update on table public.profiles from anon, authenticated;
grant update (name, department) on table public.profiles to authenticated;

insert into public.profiles (id, name, email, department, role)
select
  users.id,
  coalesce(users.raw_user_meta_data->>'name', split_part(users.email, '@', 1)),
  users.email,
  coalesce(users.raw_user_meta_data->>'department', '未設定'),
  'user'
from auth.users as users
where users.email is not null
on conflict (id) do nothing;

alter table public.books
  drop column if exists isbn;

alter table public.books
  alter column department set default '',
  alter column course set default '',
  alter column teacher set default '';

alter table public.books
  add column if not exists review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected')),
  add column if not exists review_note text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

-- Preserve any listings created before moderation was introduced.
update public.books
set review_status = 'approved'
where review_status = 'pending' and reviewed_at is null;

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
    where id = auth.uid() and role = 'moderator'
  ) or public.is_verified_admin();
$$;

grant execute on function public.is_moderator() to anon, authenticated;
revoke execute on function public.is_moderator() from public;

create or replace function public.enforce_book_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    new.review_status := 'pending';
    new.review_note := '';
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_book_review_trigger on public.books;
create trigger enforce_book_review_trigger
  before insert or update on public.books
  for each row execute procedure public.enforce_book_review();

drop policy if exists "Books are publicly readable" on public.books;
drop policy if exists "Users can create their own listings" on public.books;
drop policy if exists "Sellers can update their own listings" on public.books;
drop policy if exists "Sellers can delete their own listings" on public.books;
drop policy if exists "Approved books are public and parties can review their records" on public.books;
drop policy if exists "Users can create pending listings" on public.books;
drop policy if exists "Sellers and moderators can delete listings" on public.books;

create policy "Approved books are public and parties can review their records"
  on public.books for select
  using (
    review_status = 'approved'
    or seller_id = auth.uid()
    or public.is_moderator()
  );

create policy "Users can create pending listings"
  on public.books for insert to authenticated
  with check (auth.uid() = seller_id and review_status = 'pending');

create policy "Sellers can update their own listings"
  on public.books for update to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create policy "Sellers and moderators can delete listings"
  on public.books for delete to authenticated
  using (auth.uid() = seller_id or public.is_moderator());

create or replace function public.review_book(
  target_book_id uuid,
  decision text,
  note text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  update public.books
  set review_status = decision,
      review_note = coalesce(note, ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = target_book_id;

  if not found then
    raise exception 'Book not found';
  end if;
end;
$$;

revoke execute on function public.review_book(uuid, text, text) from public, anon;
grant execute on function public.review_book(uuid, text, text) to authenticated;

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

  update public.profiles set role = new_role where id = target_user_id;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Bootstrap the first administrator.
update public.profiles
set role = 'admin'
where lower(email) = 'ericpeng0604@gmail.com';
