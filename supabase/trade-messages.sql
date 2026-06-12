-- Run after transactions-and-notifications.sql.
-- In-app trade chat for accepted purchase requests.

create table if not exists public.trade_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists trade_messages_request_idx
  on public.trade_messages (request_id, created_at);

alter table public.trade_messages enable row level security;

drop policy if exists "Trade participants read messages" on public.trade_messages;
drop policy if exists "Trade participants send messages" on public.trade_messages;

create policy "Trade participants read messages"
  on public.trade_messages for select to authenticated
  using (
    exists (
      select 1
      from public.purchase_requests pr
      join public.books b on b.id = pr.book_id
      where pr.id = trade_messages.request_id
        and pr.status = 'accepted'
        and (pr.buyer_id = auth.uid() or b.seller_id = auth.uid())
    )
  );

create policy "Trade participants send messages"
  on public.trade_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.purchase_requests pr
      join public.books b on b.id = pr.book_id
      where pr.id = request_id
        and pr.status = 'accepted'
        and (pr.buyer_id = auth.uid() or b.seller_id = auth.uid())
    )
  );

revoke all on table public.trade_messages from anon, authenticated;
grant select, insert on table public.trade_messages to authenticated;

alter table public.trade_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.trade_messages;
exception
  when duplicate_object then null;
end $$;
