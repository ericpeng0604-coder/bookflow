-- Paginated moderator queue for trade-risk review. Raw evidence stays on the
-- detail RPC and is never included in the list response.

create table if not exists public.risk_review_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'viewed', 'processed')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists risk_review_states_status_updated_idx
  on public.risk_review_states (status, updated_at desc);

alter table public.risk_review_states enable row level security;
revoke all on public.risk_review_states from anon, authenticated;

alter table public.risk_audit_logs drop constraint if exists risk_audit_logs_action_check;
alter table public.risk_audit_logs
  add constraint risk_audit_logs_action_check check (action in (
    'badge_approved',
    'badge_rejected',
    'badge_auto_revoked',
    'policy_updated',
    'review_submitted',
    'risk_review_status_updated'
  ));

drop function if exists public.list_risk_profiles_for_moderation();

create or replace function public.list_risk_profiles_for_moderation(
  p_scope text default 'queue',
  p_status text default 'pending',
  p_risk_level text default 'all',
  p_query text default '',
  p_department text default '',
  p_limit integer default 20,
  p_offset integer default 0
)
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
  review_status text,
  review_updated_at timestamptz,
  computed_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.is_moderator() then raise exception 'Moderator permission required'; end if;
  if p_scope not in ('queue', 'all') then raise exception 'Invalid risk scope'; end if;
  if p_status not in ('pending', 'viewed', 'processed', 'all') then raise exception 'Invalid risk review status'; end if;
  if p_risk_level not in ('low', 'medium', 'high', 'all') then raise exception 'Invalid risk level'; end if;

  return query
    with candidates as (
      select
        profile.id,
        profile.name,
        profile.department,
        coalesce(risk.completed_trade_count, 0) as completed_trade_count,
        coalesce(risk.review_count, 0) as review_count,
        coalesce(risk.average_rating, 0) as average_rating,
        coalesce(risk.low_rating_count, 0) as low_rating_count,
        coalesce(risk.resolved_report_count, 0) as resolved_report_count,
        coalesce(risk.serious_report_count, 0) as serious_report_count,
        coalesce(risk.risk_score, 0) as risk_score,
        coalesce(risk.risk_level, 'low') as risk_level,
        coalesce(risk.seller_badge_eligible, false) as seller_badge_eligible,
        coalesce(risk.buyer_badge_eligible, false) as buyer_badge_eligible,
        seller_badge.status as seller_badge_status,
        buyer_badge.status as buyer_badge_status,
        coalesce(review_state.status, 'pending') as review_status,
        review_state.updated_at as review_updated_at,
        coalesce(risk.computed_at, profile.created_at) as computed_at
      from public.profiles profile
      left join public.risk_profiles risk on risk.user_id = profile.id
      left join public.risk_review_states review_state on review_state.user_id = profile.id
      left join public.trust_badges seller_badge
        on seller_badge.user_id = profile.id and seller_badge.badge_type = 'seller'
      left join public.trust_badges buyer_badge
        on buyer_badge.user_id = profile.id and buyer_badge.badge_type = 'buyer'
      where (p_scope = 'all' or coalesce(risk.risk_level, 'low') in ('high', 'medium'))
        and (p_status = 'all' or coalesce(review_state.status, 'pending') = p_status)
        and (p_risk_level = 'all' or coalesce(risk.risk_level, 'low') = p_risk_level)
        and (
          trim(coalesce(p_query, '')) = ''
          or profile.name ilike '%' || trim(p_query) || '%'
          or coalesce(profile.department, '') ilike '%' || trim(p_query) || '%'
        )
        and (
          trim(coalesce(p_department, '')) = ''
          or coalesce(profile.department, '') = p_department
        )
    )
    select
      candidates.id,
      candidates.name,
      candidates.department,
      candidates.completed_trade_count,
      candidates.review_count,
      candidates.average_rating,
      candidates.low_rating_count,
      candidates.resolved_report_count,
      candidates.serious_report_count,
      candidates.risk_score,
      candidates.risk_level,
      candidates.seller_badge_eligible,
      candidates.buyer_badge_eligible,
      candidates.seller_badge_status,
      candidates.buyer_badge_status,
      candidates.review_status,
      candidates.review_updated_at,
      candidates.computed_at,
      count(*) over ()
    from candidates
    order by
      case candidates.risk_level when 'high' then 0 when 'medium' then 1 else 2 end,
      candidates.risk_score desc,
      candidates.computed_at desc,
      candidates.id
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.list_risk_profiles_for_moderation(text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.list_risk_profiles_for_moderation(text, text, text, text, text, integer, integer) to authenticated;

create or replace function public.get_risk_moderation_summary()
returns table (
  queue_count bigint,
  pending_count bigint,
  viewed_count bigint,
  processed_count bigint,
  high_count bigint,
  medium_count bigint,
  low_count bigint,
  all_count bigint
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.is_moderator() then raise exception 'Moderator permission required'; end if;

  return query
    with candidates as (
      select
        coalesce(risk.risk_level, 'low') as risk_level,
        coalesce(review_state.status, 'pending') as review_status
      from public.profiles profile
      left join public.risk_profiles risk on risk.user_id = profile.id
      left join public.risk_review_states review_state on review_state.user_id = profile.id
    )
    select
      count(*) filter (where risk_level in ('high', 'medium') and review_status = 'pending'),
      count(*) filter (where review_status = 'pending'),
      count(*) filter (where review_status = 'viewed'),
      count(*) filter (where review_status = 'processed'),
      count(*) filter (where risk_level = 'high'),
      count(*) filter (where risk_level = 'medium'),
      count(*) filter (where risk_level = 'low'),
      count(*)
    from candidates;
end;
$$;

revoke all on function public.get_risk_moderation_summary() from public, anon;
grant execute on function public.get_risk_moderation_summary() to authenticated;

create or replace function public.get_risk_profile_for_moderation(target_user_id uuid)
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
  review_status text,
  review_updated_at timestamptz,
  review_evidence jsonb,
  report_evidence jsonb,
  computed_at timestamptz,
  total_count bigint
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
      coalesce(review_state.status, 'pending'),
      review_state.updated_at,
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
      coalesce(risk.computed_at, profile.created_at),
      1::bigint
    from public.profiles profile
    left join public.risk_profiles risk on risk.user_id = profile.id
    left join public.risk_review_states review_state on review_state.user_id = profile.id
    left join public.trust_badges seller_badge
      on seller_badge.user_id = profile.id and seller_badge.badge_type = 'seller'
    left join public.trust_badges buyer_badge
      on buyer_badge.user_id = profile.id and buyer_badge.badge_type = 'buyer'
    where profile.id = target_user_id;
end;
$$;

revoke all on function public.get_risk_profile_for_moderation(uuid) from public, anon;
grant execute on function public.get_risk_profile_for_moderation(uuid) to authenticated;

create or replace function public.update_risk_review_status(target_user_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  previous_status text;
begin
  if not public.is_moderator() then raise exception 'Moderator permission required'; end if;
  if new_status not in ('pending', 'viewed', 'processed') then raise exception 'Invalid risk review status'; end if;

  select status into previous_status
  from public.risk_review_states
  where user_id = target_user_id;

  insert into public.risk_review_states (user_id, status, updated_by, updated_at)
  values (target_user_id, new_status, auth.uid(), now())
  on conflict (user_id) do update set
    status = excluded.status,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.risk_audit_logs (actor_id, action, target_user_id, details)
  values (
    auth.uid(),
    'risk_review_status_updated',
    target_user_id,
    jsonb_build_object('previous_status', coalesce(previous_status, 'pending'), 'new_status', new_status)
  );
end;
$$;

revoke all on function public.update_risk_review_status(uuid, text) from public, anon;
grant execute on function public.update_risk_review_status(uuid, text) to authenticated;
