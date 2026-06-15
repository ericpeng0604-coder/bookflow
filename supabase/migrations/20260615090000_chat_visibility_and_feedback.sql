-- Per-user chat hiding and authenticated product feedback.

create table if not exists public.conversation_user_preferences (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_user_preferences enable row level security;

drop policy if exists "Users read their conversation preferences" on public.conversation_user_preferences;
create policy "Users read their conversation preferences"
  on public.conversation_user_preferences for select to authenticated
  using (user_id = auth.uid());

revoke all on public.conversation_user_preferences from public, anon, authenticated;
grant select on public.conversation_user_preferences to authenticated;

create or replace function public.hide_closed_conversation(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.conversations
    where id = target_conversation_id
      and status = 'closed'
      and auth.uid() in (buyer_id, seller_id)
  ) then
    raise exception 'Closed conversation participant required';
  end if;

  insert into public.conversation_user_preferences (conversation_id, user_id, hidden_at, updated_at)
  values (target_conversation_id, auth.uid(), now(), now())
  on conflict (conversation_id, user_id)
  do update set hidden_at = excluded.hidden_at, updated_at = excluded.updated_at;
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
    and not exists (
      select 1
      from public.conversation_user_preferences preference
      where preference.conversation_id = c.id
        and preference.user_id = auth.uid()
        and preference.hidden_at is not null
    )
  order by c.last_message_at desc;
$$;

create or replace function public.list_my_conversations_page(
  p_limit int default 30,
  p_cursor_last_message_at timestamptz default null,
  p_cursor_id uuid default null
)
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
           select count(*)
           from public.trade_messages tm
           where tm.conversation_id = c.id
             and tm.sender_id <> auth.uid()
             and tm.created_at > case
               when auth.uid() = c.buyer_id then c.buyer_read_at
               else c.seller_read_at
             end
         )::bigint,
         c.created_at
  from public.conversations c
  where auth.uid() in (c.buyer_id, c.seller_id)
    and not exists (
      select 1
      from public.conversation_user_preferences preference
      where preference.conversation_id = c.id
        and preference.user_id = auth.uid()
        and preference.hidden_at is not null
    )
    and (
      p_cursor_last_message_at is null
      or p_cursor_id is null
      or (c.last_message_at, c.id) < (p_cursor_last_message_at, p_cursor_id)
    )
  order by c.last_message_at desc, c.id desc
  limit greatest(least(coalesce(p_limit, 30), 100), 1);
$$;

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('suggestion', 'bug', 'experience', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  resolution_note text not null default '' check (char_length(resolution_note) <= 1000),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_status_created_idx
  on public.user_feedback (status, created_at desc);

alter table public.user_feedback enable row level security;
revoke all on public.user_feedback from public, anon, authenticated;

create or replace function public.submit_feedback(
  feedback_category text,
  feedback_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if feedback_category not in ('suggestion', 'bug', 'experience', 'other') then
    raise exception 'Invalid feedback category';
  end if;
  if char_length(btrim(coalesce(feedback_message, ''))) not between 10 and 2000 then
    raise exception 'Feedback must be between 10 and 2000 characters';
  end if;
  if (
    select count(*)
    from public.user_feedback
    where user_id = auth.uid()
      and created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Daily feedback limit reached';
  end if;

  insert into public.user_feedback (user_id, category, message)
  values (auth.uid(), feedback_category, btrim(feedback_message))
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.list_feedback_for_moderation()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  category text,
  message text,
  status text,
  resolution_note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;

  return query
    select feedback.id,
           feedback.user_id,
           profiles.name,
           feedback.category,
           feedback.message,
           feedback.status,
           feedback.resolution_note,
           feedback.created_at
    from public.user_feedback feedback
    join public.profiles profiles on profiles.id = feedback.user_id
    order by case when feedback.status = 'pending' then 0 else 1 end,
             feedback.created_at desc
    limit 200;
end;
$$;

create or replace function public.resolve_feedback(
  target_feedback_id uuid,
  note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator permission required';
  end if;

  update public.user_feedback
  set status = 'resolved',
      resolution_note = left(btrim(coalesce(note, '')), 1000),
      resolved_by = auth.uid(),
      resolved_at = now()
  where id = target_feedback_id and status = 'pending';

  if not found then
    raise exception 'Pending feedback not found';
  end if;
end;
$$;

revoke execute on function public.hide_closed_conversation(uuid) from public, anon;
revoke execute on function public.submit_feedback(text, text) from public, anon;
revoke execute on function public.list_feedback_for_moderation() from public, anon;
revoke execute on function public.resolve_feedback(uuid, text) from public, anon;

grant execute on function public.hide_closed_conversation(uuid) to authenticated;
grant execute on function public.submit_feedback(text, text) to authenticated;
grant execute on function public.list_feedback_for_moderation() to authenticated;
grant execute on function public.resolve_feedback(uuid, text) to authenticated;
