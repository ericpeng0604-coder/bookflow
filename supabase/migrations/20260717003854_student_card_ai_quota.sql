-- Bound student-card Gemini usage and make network retries idempotent.
-- This table intentionally has no client RLS policies: only service_role
-- functions may reserve or finalize quota.
create table if not exists public.student_card_ai_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  idempotency_key text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'released')),
  expires_at timestamptz not null,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  released_at timestamptz,
  unique (user_id, usage_date, idempotency_key)
);

create index if not exists student_card_ai_quota_reservations_expiry_idx
  on public.student_card_ai_quota_reservations (expires_at)
  where status = 'reserved';

alter table public.student_card_ai_quota_reservations enable row level security;
revoke all on public.student_card_ai_quota_reservations from public, anon, authenticated;

create or replace function public.reserve_student_card_ai_quota(
  target_user_id uuid,
  request_key text,
  daily_limit integer default 5
)
returns table (
  allowed boolean,
  remaining integer,
  reservation_id uuid,
  reservation_state text,
  response_payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  today_utc date := (timezone('UTC', now()))::date;
  active_count integer;
  existing public.student_card_ai_quota_reservations;
  created_id uuid;
begin
  if target_user_id is null
    or char_length(btrim(coalesce(request_key, ''))) not between 16 and 100
    or daily_limit not between 1 and 20 then
    raise exception 'Invalid student card AI quota reservation';
  end if;

  if not public.is_active_user(target_user_id) then
    return query select false, 0, null::uuid, 'inactive'::text, null::jsonb;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('student-card-ai:' || target_user_id::text || ':' || today_utc::text));

  update public.student_card_ai_quota_reservations
  set status = 'released', released_at = now()
  where user_id = target_user_id
    and usage_date = today_utc
    and status = 'reserved'
    and expires_at <= now();

  select * into existing
  from public.student_card_ai_quota_reservations
  where user_id = target_user_id
    and usage_date = today_utc
    and idempotency_key = btrim(request_key);

  if existing.id is not null and existing.status in ('reserved', 'completed') then
    select count(*) into active_count
    from public.student_card_ai_quota_reservations
    where user_id = target_user_id
      and usage_date = today_utc
      and status in ('reserved', 'completed');

    return query select
      false,
      greatest(daily_limit - active_count, 0),
      existing.id,
      existing.status,
      existing.response_payload;
    return;
  end if;

  if existing.id is not null and existing.status = 'released' then
    select count(*) into active_count
    from public.student_card_ai_quota_reservations
    where user_id = target_user_id
      and usage_date = today_utc
      and status in ('reserved', 'completed');

    if active_count >= daily_limit then
      return query select false, 0, null::uuid, 'exhausted'::text, null::jsonb;
      return;
    end if;

    update public.student_card_ai_quota_reservations
    set status = 'reserved',
        expires_at = now() + interval '2 minutes',
        response_payload = null,
        released_at = null,
        completed_at = null
    where id = existing.id;
    created_id := existing.id;
  else
    select count(*) into active_count
    from public.student_card_ai_quota_reservations
    where user_id = target_user_id
      and usage_date = today_utc
      and status in ('reserved', 'completed');

    if active_count >= daily_limit then
      return query select false, 0, null::uuid, 'exhausted'::text, null::jsonb;
      return;
    end if;

    insert into public.student_card_ai_quota_reservations (
      user_id, usage_date, idempotency_key, expires_at
    ) values (
      target_user_id, today_utc, btrim(request_key), now() + interval '2 minutes'
    )
    returning id into created_id;
  end if;

  select count(*) into active_count
  from public.student_card_ai_quota_reservations
  where user_id = target_user_id
    and usage_date = today_utc
    and status in ('reserved', 'completed');

  return query select
    true,
    greatest(daily_limit - active_count, 0),
    created_id,
    'reserved'::text,
    null::jsonb;
end;
$$;

create or replace function public.finalize_student_card_ai_quota(
  target_reservation_id uuid,
  succeeded boolean,
  new_response_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.student_card_ai_quota_reservations;
begin
  select * into target
  from public.student_card_ai_quota_reservations
  where id = target_reservation_id
  for update;

  if target.id is null or target.status <> 'reserved' then
    return;
  end if;

  if succeeded then
    update public.student_card_ai_quota_reservations
    set status = 'completed',
        response_payload = new_response_payload,
        completed_at = now()
    where id = target.id;
  else
    update public.student_card_ai_quota_reservations
    set status = 'released', released_at = now()
    where id = target.id;
  end if;
end;
$$;

revoke execute on function public.reserve_student_card_ai_quota(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.finalize_student_card_ai_quota(uuid, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_student_card_ai_quota(uuid, text, integer)
  to service_role;
grant execute on function public.finalize_student_card_ai_quota(uuid, boolean, jsonb)
  to service_role;
