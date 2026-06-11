-- Bind an Email OTP proof to the same password-authenticated admin session.

create table if not exists public.admin_login_verifications (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now()
);

alter table public.admin_login_verifications enable row level security;
revoke all on table public.admin_login_verifications from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_login_verifications to service_role;

create index if not exists admin_login_verifications_user_id_idx
  on public.admin_login_verifications (user_id);

drop table if exists public.admin_login_challenges;

create or replace function public.is_verified_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.account_status = 'active'
      and exists (
        select 1
        from public.admin_login_verifications verification
        where verification.user_id = auth.uid()
          and verification.session_id::text = auth.jwt()->>'session_id'
      )
  );
$$;

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

drop policy if exists "Admins read action logs" on public.admin_action_logs;
drop policy if exists "Verified admins read action logs" on public.admin_action_logs;
create policy "Verified admins read action logs"
  on public.admin_action_logs for select to authenticated
  using (public.is_verified_admin());

create or replace function public.list_profiles_for_admin()
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
    raise exception 'Verified admin permission required';
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
    raise exception 'Verified admin permission required';
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
    raise exception 'Verified admin permission required';
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
