-- Support profiles created by Google OAuth identities.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, department, role)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'name'), ''),
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        split_part(new.email, '@', 1)
      ),
      60
    ),
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'department'), ''), '未設定'),
    case when lower(new.email) = 'ericpeng0604@gmail.com' then 'admin' else 'user' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
