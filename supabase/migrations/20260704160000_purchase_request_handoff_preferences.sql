alter table public.purchase_requests
  add column if not exists preferred_meetup_location text not null default '',
  add column if not exists preferred_meetup_time text not null default '';

drop function if exists public.create_purchase_request(uuid, text);

create or replace function public.create_purchase_request(
  target_book_id uuid,
  request_message text default '',
  preferred_meetup_location text default '',
  preferred_meetup_time text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  requester uuid := auth.uid();
  existing_request uuid;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  select id
    into existing_request
  from public.purchase_requests
  where book_id = target_book_id
    and buyer_id = requester
    and status in ('pending', 'waitlisted', 'reserved')
  order by created_at desc
  limit 1;

  if existing_request is not null then
    update public.purchase_requests
    set message = left(coalesce(request_message, ''), 500),
        preferred_meetup_location = left(coalesce(create_purchase_request.preferred_meetup_location, ''), 120),
        preferred_meetup_time = left(coalesce(create_purchase_request.preferred_meetup_time, ''), 120),
        updated_at = now()
    where id = existing_request;

    return existing_request;
  end if;

  if not exists (
    select 1
    from public.books
    where id = target_book_id
      and seller_id <> requester
      and status = 'available'
      and lifecycle_state = 'active'
      and review_status = 'approved'
      and moderation_visibility = 'visible'
  ) then
    raise exception 'Listing unavailable';
  end if;

  insert into public.purchase_requests (
    book_id,
    buyer_id,
    message,
    preferred_meetup_location,
    preferred_meetup_time,
    status
  )
  values (
    target_book_id,
    requester,
    left(coalesce(request_message, ''), 500),
    left(coalesce(preferred_meetup_location, ''), 120),
    left(coalesce(preferred_meetup_time, ''), 120),
    'pending'
  )
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.create_purchase_request(uuid, text, text, text) from public;
revoke all on function public.create_purchase_request(uuid, text, text, text) from anon;
grant execute on function public.create_purchase_request(uuid, text, text, text) to authenticated;
