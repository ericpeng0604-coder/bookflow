-- Trade reviews, private risk summaries, and manually approved trust badges.
-- Run after the reports, moderation, and multi-party order migrations.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.trade_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  constraint trade_reviews_distinct_parties check (reviewer_id <> reviewee_id),
  constraint trade_reviews_allowed_tags check (
    tags <@ array[
      'item_as_described',
      'punctual',
      'clear_communication',
      'no_show',
      'misleading',
      'other'
    ]::text[]
  ),
  unique (request_id, reviewer_id)
);

create index if not exists trade_reviews_reviewee_created_idx
  on public.trade_reviews (reviewee_id, created_at desc);
create index if not exists trade_reviews_request_idx
  on public.trade_reviews (request_id, created_at);

create table if not exists public.risk_policy_settings (
  id integer primary key default 1 check (id = 1),
  min_completed_trades integer not null default 3 check (min_completed_trades between 1 and 1000),
  good_badge_min_average numeric(3,2) not null default 4.50 check (good_badge_min_average between 1 and 5),
  good_badge_max_serious_reports integer not null default 0 check (good_badge_max_serious_reports between 0 and 1000),
  medium_risk_score integer not null default 4 check (medium_risk_score between 1 and 10000),
  high_risk_score integer not null default 8 check (high_risk_score > medium_risk_score and high_risk_score <= 10000),
  one_star_penalty integer not null default 4 check (one_star_penalty between 0 and 100),
  two_star_penalty integer not null default 2 check (two_star_penalty between 0 and 100),
  three_star_penalty integer not null default 1 check (three_star_penalty between 0 and 100),
  fraud_report_weight integer not null default 5 check (fraud_report_weight between 0 and 100),
  harassment_report_weight integer not null default 4 check (harassment_report_weight between 0 and 100),
  no_show_report_weight integer not null default 3 check (no_show_report_weight between 0 and 100),
  misleading_report_weight integer not null default 2 check (misleading_report_weight between 0 and 100),
  duplicate_report_weight integer not null default 1 check (duplicate_report_weight between 0 and 100),
  other_report_weight integer not null default 1 check (other_report_weight between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.risk_policy_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.risk_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  completed_trade_count integer not null default 0,
  review_count integer not null default 0,
  average_rating numeric(3,2) not null default 0,
  low_rating_count integer not null default 0,
  resolved_report_count integer not null default 0,
  serious_report_count integer not null default 0,
  risk_score integer not null default 0,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  seller_badge_eligible boolean not null default false,
  buyer_badge_eligible boolean not null default false,
  computed_at timestamptz not null default now()
);

create index if not exists risk_profiles_level_score_idx
  on public.risk_profiles (risk_level, risk_score desc, computed_at desc);

create table if not exists public.trust_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_type text not null check (badge_type in ('seller', 'buyer')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, badge_type)
);

create index if not exists trust_badges_public_idx
  on public.trust_badges (user_id, badge_type)
  where status = 'approved';

create table if not exists public.risk_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in (
    'badge_approved',
    'badge_rejected',
    'badge_auto_revoked',
    'policy_updated',
    'review_submitted'
  )),
  target_user_id uuid references public.profiles(id) on delete set null,
  request_id uuid references public.purchase_requests(id) on delete set null,
  badge_type text check (badge_type is null or badge_type in ('seller', 'buyer')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists risk_audit_logs_created_idx
  on public.risk_audit_logs (created_at desc);
create index if not exists risk_audit_logs_target_idx
  on public.risk_audit_logs (target_user_id, created_at desc);

alter table public.trade_reviews enable row level security;
alter table public.risk_policy_settings enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.trust_badges enable row level security;
alter table public.risk_audit_logs enable row level security;

revoke all on public.trade_reviews from anon, authenticated;
revoke all on public.risk_policy_settings from anon, authenticated;
revoke all on public.risk_profiles from anon, authenticated;
revoke all on public.trust_badges from anon, authenticated;
revoke all on public.risk_audit_logs from anon, authenticated;

drop policy if exists "Approved trust badges are public" on public.trust_badges;
create policy "Approved trust badges are public"
  on public.trust_badges for select to anon, authenticated
  using (status = 'approved');
grant select on public.trust_badges to anon, authenticated;

create or replace function private.recompute_risk_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  policy public.risk_policy_settings;
  completed_count integer;
  review_total integer;
  average numeric(3,2);
  low_count integer;
  resolved_reports integer;
  serious_reports integer;
  total_score integer;
  report_score integer;
  review_score integer;
  next_level text;
  seller_eligible boolean;
  buyer_eligible boolean;
begin
  select * into policy from public.risk_policy_settings where id = 1;

  select count(*)::integer into completed_count
  from public.purchase_requests request
  join public.books book on book.id = request.book_id
  where request.status = 'completed'
    and (request.buyer_id = target_user_id or book.seller_id = target_user_id);

  select
    count(*)::integer,
    coalesce(round(avg(rating)::numeric, 2), 0)::numeric(3,2),
    count(*) filter (where rating <= 2)::integer
  into review_total, average, low_count
  from public.trade_reviews
  where reviewee_id = target_user_id;

  with target_reports as (
    select report.reason
    from public.reports report
    where report.status = 'resolved'
      and (
        (report.target_type = 'user' and report.target_id = target_user_id)
        or (
          report.target_type = 'book'
          and exists (
            select 1 from public.books book
            where book.id = report.target_id and book.seller_id = target_user_id
          )
        )
      )
  )
  select
    count(*)::integer,
    count(*) filter (where reason in ('fraud', 'harassment', 'no_show'))::integer,
    coalesce(sum(case reason
      when 'fraud' then policy.fraud_report_weight
      when 'harassment' then policy.harassment_report_weight
      when 'no_show' then policy.no_show_report_weight
      when 'misleading' then policy.misleading_report_weight
      when 'duplicate' then policy.duplicate_report_weight
      else policy.other_report_weight
    end), 0)::integer
  into resolved_reports, serious_reports, report_score
  from target_reports;

  select coalesce(sum(case rating
    when 1 then policy.one_star_penalty
    when 2 then policy.two_star_penalty
    when 3 then policy.three_star_penalty
    else 0
  end), 0)::integer
  into review_score
  from public.trade_reviews
  where reviewee_id = target_user_id;

  total_score := coalesce(report_score, 0) + coalesce(review_score, 0);

  next_level := case
    when total_score >= policy.high_risk_score then 'high'
    when total_score >= policy.medium_risk_score then 'medium'
    else 'low'
  end;

  seller_eligible := completed_count >= policy.min_completed_trades
    and review_total > 0
    and average >= policy.good_badge_min_average
    and serious_reports <= policy.good_badge_max_serious_reports;
  buyer_eligible := seller_eligible;

  insert into public.risk_profiles (
    user_id, completed_trade_count, review_count, average_rating,
    low_rating_count, resolved_report_count, serious_report_count,
    risk_score, risk_level, seller_badge_eligible, buyer_badge_eligible,
    computed_at
  ) values (
    target_user_id, completed_count, review_total, average,
    low_count, resolved_reports, serious_reports,
    total_score, next_level, seller_eligible, buyer_eligible,
    now()
  ) on conflict (user_id) do update set
    completed_trade_count = excluded.completed_trade_count,
    review_count = excluded.review_count,
    average_rating = excluded.average_rating,
    low_rating_count = excluded.low_rating_count,
    resolved_report_count = excluded.resolved_report_count,
    serious_report_count = excluded.serious_report_count,
    risk_score = excluded.risk_score,
    risk_level = excluded.risk_level,
    seller_badge_eligible = excluded.seller_badge_eligible,
    buyer_badge_eligible = excluded.buyer_badge_eligible,
    computed_at = excluded.computed_at;

  insert into public.trust_badges (user_id, badge_type, status)
  values
    (target_user_id, 'seller', 'pending'),
    (target_user_id, 'buyer', 'pending')
  on conflict (user_id, badge_type) do nothing;

  update public.trust_badges
  set status = 'rejected',
      approved_by = null,
      approved_at = null,
      review_note = '系統重新計算後已不符合目前公開資格',
      updated_at = now()
  where user_id = target_user_id
    and status = 'approved'
    and ((badge_type = 'seller' and not seller_eligible)
      or (badge_type = 'buyer' and not buyer_eligible));

  if found then
    insert into public.risk_audit_logs (action, target_user_id, details)
    values ('badge_auto_revoked', target_user_id, jsonb_build_object(
      'seller_eligible', seller_eligible,
      'buyer_eligible', buyer_eligible,
      'risk_level', next_level
    ));
  end if;
end;
$$;

revoke all on function private.recompute_risk_profile(uuid) from public;

create or replace function private.refresh_risk_after_trade()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare seller_id uuid;
begin
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    select book.seller_id into seller_id from public.books book where book.id = new.book_id;
    perform private.recompute_risk_profile(new.buyer_id);
    if seller_id is not null then perform private.recompute_risk_profile(seller_id); end if;
  end if;
  return new;
end;
$$;

create or replace function private.refresh_risk_after_report()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare affected_user_id uuid;
begin
  if new.status = 'resolved' and coalesce(old.status, '') <> 'resolved' then
    if new.target_type = 'user' then
      affected_user_id := new.target_id;
    else
      select book.seller_id into affected_user_id
      from public.books book where book.id = new.target_id;
    end if;
    if affected_user_id is not null then perform private.recompute_risk_profile(affected_user_id); end if;
  end if;
  return new;
end;
$$;

revoke all on function private.refresh_risk_after_trade() from public;
revoke all on function private.refresh_risk_after_report() from public;

drop trigger if exists refresh_risk_profile_after_trade on public.purchase_requests;
create trigger refresh_risk_profile_after_trade
  after update of status on public.purchase_requests
  for each row execute function private.refresh_risk_after_trade();

drop trigger if exists refresh_risk_profile_after_report on public.reports;
create trigger refresh_risk_profile_after_report
  after update of status on public.reports
  for each row execute function private.refresh_risk_after_report();

create or replace function public.submit_trade_review(
  target_request_id uuid,
  review_rating integer,
  review_tags text[] default '{}',
  review_comment text default ''
) returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_request public.purchase_requests;
  target_seller uuid;
  reviewee uuid;
  created_id uuid;
  clean_comment text := left(btrim(coalesce(review_comment, '')), 500);
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if review_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  if review_tags is null or not (review_tags <@ array[
    'item_as_described', 'punctual', 'clear_communication',
    'no_show', 'misleading', 'other'
  ]::text[]) then
    raise exception 'Invalid review tags';
  end if;

  select request
  into target_request
  from public.purchase_requests request
  join public.books book on book.id = request.book_id
  where request.id = target_request_id and request.status = 'completed';

  select book.seller_id
  into target_seller
  from public.books book
  where book.id = target_request.book_id;

  if target_request.id is null then
    raise exception 'Completed trade required';
  end if;
  if auth.uid() <> target_request.buyer_id and auth.uid() <> target_seller then
    raise exception 'Trade party required';
  end if;

  reviewee := case when auth.uid() = target_request.buyer_id then target_seller else target_request.buyer_id end;

  insert into public.trade_reviews (
    request_id, reviewer_id, reviewee_id, rating, tags, comment
  ) values (
    target_request_id, auth.uid(), reviewee, review_rating,
    coalesce(review_tags, '{}'), clean_comment
  ) returning id into created_id;

  perform private.recompute_risk_profile(reviewee);

  insert into public.risk_audit_logs (
    actor_id, action, target_user_id, request_id, details
  ) values (
    auth.uid(), 'review_submitted', reviewee, target_request_id,
    jsonb_build_object('rating', review_rating, 'tags', coalesce(review_tags, '{}'))
  );
  return created_id;
exception
  when unique_violation then
    raise exception 'You already reviewed this completed trade';
end;
$$;

revoke all on function public.submit_trade_review(uuid, integer, text[], text) from public, anon;
grant execute on function public.submit_trade_review(uuid, integer, text[], text) to authenticated;

create or replace function public.get_my_review_status(target_request_id uuid)
returns table (reviewed boolean, reviewee_id uuid, reviewee_name text)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
    select
      exists (
        select 1 from public.trade_reviews review
        where review.request_id = target_request_id and review.reviewer_id = auth.uid()
      ),
      case
        when request.buyer_id = auth.uid() then book.seller_id
        else request.buyer_id
      end,
      case
        when request.buyer_id = auth.uid() then seller.name
        else buyer.name
      end
    from public.purchase_requests request
    join public.books book on book.id = request.book_id
    join public.profiles buyer on buyer.id = request.buyer_id
    join public.profiles seller on seller.id = book.seller_id
    where request.id = target_request_id
      and request.status = 'completed'
      and auth.uid() in (request.buyer_id, book.seller_id);
end;
$$;

revoke all on function public.get_my_review_status(uuid) from public, anon;
grant execute on function public.get_my_review_status(uuid) to authenticated;

create or replace function public.get_public_trust_badges(target_user_ids uuid[])
returns table (user_id uuid, badge_type text, label text, approved_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select badge.user_id,
         badge.badge_type,
         case when badge.badge_type = 'seller' then '優良賣家' else '推薦買家' end,
         badge.approved_at
  from public.trust_badges badge
  where badge.status = 'approved'
    and badge.user_id = any(coalesce(target_user_ids, '{}'));
$$;

revoke all on function public.get_public_trust_badges(uuid[]) from public;
grant execute on function public.get_public_trust_badges(uuid[]) to anon, authenticated;

create or replace function public.list_risk_profiles_for_moderation()
returns table (
  user_id uuid,
  user_name text,
  user_department text,
  completed_trade_count integer,
  review_count integer,
  average_rating numeric,
  low_rating_count integer,
  resolved_report_count integer,
  serious_report_count integer,
  risk_score integer,
  risk_level text,
  seller_badge_eligible boolean,
  buyer_badge_eligible boolean,
  seller_badge_status text,
  buyer_badge_status text,
  review_evidence jsonb,
  report_evidence jsonb,
  computed_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.is_moderator() then raise exception 'Moderator permission required'; end if;

  return query
    select
      profile.id,
      profile.name,
      profile.department,
      coalesce(risk.completed_trade_count, 0),
      coalesce(risk.review_count, 0),
      coalesce(risk.average_rating, 0),
      coalesce(risk.low_rating_count, 0),
      coalesce(risk.resolved_report_count, 0),
      coalesce(risk.serious_report_count, 0),
      coalesce(risk.risk_score, 0),
      coalesce(risk.risk_level, 'low'),
      coalesce(risk.seller_badge_eligible, false),
      coalesce(risk.buyer_badge_eligible, false),
      seller_badge.status,
      buyer_badge.status,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', review.id,
        'request_id', review.request_id,
        'reviewer_id', review.reviewer_id,
        'reviewer_name', reviewer.name,
        'rating', review.rating,
        'tags', review.tags,
        'comment', review.comment,
        'created_at', review.created_at
      ) order by review.created_at desc)
      from public.trade_reviews review
      join public.profiles reviewer on reviewer.id = review.reviewer_id
      where review.reviewee_id = profile.id), '[]'::jsonb),
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', report.id,
        'target_type', report.target_type,
        'target_id', report.target_id,
        'reason', report.reason,
        'details', report.details,
        'status', report.status,
        'resolution_note', report.resolution_note,
        'created_at', report.created_at
      ) order by report.created_at desc)
      from public.reports report
      where (
        report.target_type = 'user' and report.target_id = profile.id
      ) or (
        report.target_type = 'book' and exists (
          select 1 from public.books book where book.id = report.target_id and book.seller_id = profile.id
        )
      )), '[]'::jsonb),
      coalesce(risk.computed_at, now())
    from public.profiles profile
    left join public.risk_profiles risk on risk.user_id = profile.id
    left join public.trust_badges seller_badge
      on seller_badge.user_id = profile.id and seller_badge.badge_type = 'seller'
    left join public.trust_badges buyer_badge
      on buyer_badge.user_id = profile.id and buyer_badge.badge_type = 'buyer'
    order by
      case coalesce(risk.risk_level, 'low') when 'high' then 0 when 'medium' then 1 else 2 end,
      coalesce(risk.risk_score, 0) desc,
      profile.created_at desc;
end;
$$;

revoke all on function public.list_risk_profiles_for_moderation() from public, anon;
grant execute on function public.list_risk_profiles_for_moderation() to authenticated;

create or replace function public.review_trust_badge(
  target_user_id uuid,
  target_badge_type text,
  decision text,
  note text default ''
) returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  eligible boolean;
begin
  if not public.is_moderator() then raise exception 'Moderator permission required'; end if;
  if target_badge_type not in ('seller', 'buyer') then raise exception 'Invalid badge type'; end if;
  if decision not in ('approve', 'reject', 'revoke') then raise exception 'Invalid badge decision'; end if;

  select case when target_badge_type = 'seller' then seller_badge_eligible else buyer_badge_eligible end
  into eligible from public.risk_profiles where user_id = target_user_id;
  if decision = 'approve' and not coalesce(eligible, false) then
    raise exception 'User is not eligible for this badge';
  end if;

  insert into public.trust_badges (user_id, badge_type, status, approved_by, approved_at, review_note, updated_at)
  values (
    target_user_id,
    target_badge_type,
    case when decision = 'approve' then 'approved' else 'rejected' end,
    case when decision = 'approve' then auth.uid() else null end,
    case when decision = 'approve' then now() else null end,
    left(btrim(coalesce(note, '')), 1000),
    now()
  )
  on conflict (user_id, badge_type) do update set
    status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    review_note = excluded.review_note,
    updated_at = excluded.updated_at;

  insert into public.risk_audit_logs (
    actor_id, action, target_user_id, badge_type, details
  ) values (
    auth.uid(),
    case when decision = 'approve' then 'badge_approved' else 'badge_rejected' end,
    target_user_id,
    target_badge_type,
    jsonb_build_object('decision', decision, 'note', left(btrim(coalesce(note, '')), 1000))
  );
end;
$$;

revoke all on function public.review_trust_badge(uuid, text, text, text) from public, anon;
grant execute on function public.review_trust_badge(uuid, text, text, text) to authenticated;

create or replace function public.get_risk_policy()
returns table (
  min_completed_trades integer,
  good_badge_min_average numeric,
  good_badge_max_serious_reports integer,
  medium_risk_score integer,
  high_risk_score integer,
  one_star_penalty integer,
  two_star_penalty integer,
  three_star_penalty integer,
  fraud_report_weight integer,
  harassment_report_weight integer,
  no_show_report_weight integer,
  misleading_report_weight integer,
  duplicate_report_weight integer,
  other_report_weight integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.is_verified_admin() then raise exception 'Admin permission required'; end if;
  return query select
    policy.min_completed_trades,
    policy.good_badge_min_average,
    policy.good_badge_max_serious_reports,
    policy.medium_risk_score,
    policy.high_risk_score,
    policy.one_star_penalty,
    policy.two_star_penalty,
    policy.three_star_penalty,
    policy.fraud_report_weight,
    policy.harassment_report_weight,
    policy.no_show_report_weight,
    policy.misleading_report_weight,
    policy.duplicate_report_weight,
    policy.other_report_weight,
    policy.updated_at
  from public.risk_policy_settings policy where policy.id = 1;
end;
$$;

revoke all on function public.get_risk_policy() from public, anon;
grant execute on function public.get_risk_policy() to authenticated;

create or replace function public.update_risk_policy(
  new_min_completed_trades integer,
  new_good_badge_min_average numeric,
  new_good_badge_max_serious_reports integer,
  new_medium_risk_score integer,
  new_high_risk_score integer,
  new_one_star_penalty integer,
  new_two_star_penalty integer,
  new_three_star_penalty integer,
  new_fraud_report_weight integer,
  new_harassment_report_weight integer,
  new_no_show_report_weight integer,
  new_misleading_report_weight integer,
  new_duplicate_report_weight integer,
  new_other_report_weight integer
) returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  profile record;
begin
  if not public.is_verified_admin() then raise exception 'Admin permission required'; end if;
  if new_min_completed_trades not between 1 and 1000
    or new_good_badge_min_average not between 1 and 5
    or new_good_badge_max_serious_reports not between 0 and 1000
    or new_medium_risk_score not between 1 and 10000
    or new_high_risk_score <= new_medium_risk_score
    or new_high_risk_score > 10000 then
    raise exception 'Invalid risk policy thresholds';
  end if;

  update public.risk_policy_settings set
    min_completed_trades = new_min_completed_trades,
    good_badge_min_average = new_good_badge_min_average,
    good_badge_max_serious_reports = new_good_badge_max_serious_reports,
    medium_risk_score = new_medium_risk_score,
    high_risk_score = new_high_risk_score,
    one_star_penalty = new_one_star_penalty,
    two_star_penalty = new_two_star_penalty,
    three_star_penalty = new_three_star_penalty,
    fraud_report_weight = new_fraud_report_weight,
    harassment_report_weight = new_harassment_report_weight,
    no_show_report_weight = new_no_show_report_weight,
    misleading_report_weight = new_misleading_report_weight,
    duplicate_report_weight = new_duplicate_report_weight,
    other_report_weight = new_other_report_weight,
    updated_at = now()
  where id = 1;

  for profile in select id from public.profiles loop
    perform private.recompute_risk_profile(profile.id);
  end loop;

  insert into public.risk_audit_logs (actor_id, action, details)
  values (auth.uid(), 'policy_updated', jsonb_build_object(
    'min_completed_trades', new_min_completed_trades,
    'good_badge_min_average', new_good_badge_min_average,
    'good_badge_max_serious_reports', new_good_badge_max_serious_reports,
    'medium_risk_score', new_medium_risk_score,
    'high_risk_score', new_high_risk_score
  ));
end;
$$;

revoke all on function public.update_risk_policy(integer, numeric, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.update_risk_policy(integer, numeric, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) to authenticated;

do $$
declare profile record;
begin
  for profile in select id from public.profiles loop
    perform private.recompute_risk_profile(profile.id);
  end loop;
end;
$$;
