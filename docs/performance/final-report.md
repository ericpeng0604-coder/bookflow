# Campus-books capacity final report

Status: `BLOCKED / NOT VERIFIED` for the requested 2x stable-capacity goal.

## Outcome

No production load or migration was performed. The branch now contains a guarded
reproducible runner, non-secret metric artifacts, and a staging evidence report.
No application optimization was retained because no single code bottleneck was
proven and the required full-user/purchase/Realtime evidence was blocked by
external staging conditions.

## Measured staging results

- Public list: max stable tested concurrency 100, 375.33 RPS, p95 277.65 ms,
  p99 927.03 ms, 0% HTTP error rate.
- Public search: max stable tested concurrency 250, 687.79 RPS, p95 611.50 ms,
  p99 853.29 ms, 0% HTTP error rate.
- Public detail: max stable tested concurrency 100, 398.57 RPS, p95 258.96 ms,
  p99 452.12 ms, 0% HTTP error rate.
- Authenticated profile/notifications/conversations: at concurrency 100 with
  one synthetic session, p95 254.32/252.66/273.50 ms and 0% HTTP errors.
- Purchase request/race: `NOT VERIFIED`; both returned 400 `Listing unavailable`
  against correctly pending synthetic listings.
- Realtime: `NOT VERIFIED`; corrected-topic probes returned 403/network failures
  and an official-client probe timed out.

These are largest tested stages, not an exact capacity limit. The public fixture
contained 6,975 inserted synthetic books but zero publicly visible synthetic
books because the current moderation trigger enforced `review_status=pending`.

## Blockers

1. Staging Auth rate-limited the 500-session preparation with
   `Request rate limit reached`; 500-user login capacity is `NOT VERIFIED`.
2. The current moderation/RLS path does not allow the seeded synthetic listings
   into public or purchase flows without an authorized moderation workflow.
3. Realtime and query-performance reporting were unavailable/inconsistent in the
   dashboard; same-window slow-query, lock, pool, cache, and Sentry evidence is
   `NOT VERIFIED`.
4. The application URL and Browser -> Client -> Route -> Supabase -> Response ->
   UI verification for login, listing, search, detail, purchase race, chat,
   notifications, and RLS are `NOT VERIFIED`.

## Verification and checks

- `npm run check:capacity-load`: passed (17 checks).
- `npm run check:observability`: passed; local Sentry DSN/live Sentry confirmation
  remains `NOT VERIFIED`.
- Public and authenticated API load artifacts were written under `.ai/artifacts/`.
- `npm run typecheck`, `npm test` (31 tests), `npm run lint`,
  `npm run check:capacity-load`, and `npm run build` passed after the harness
  correction. Build emitted only existing workspace-root and webpack cache
  warnings.
- Full project checks remain `NOT VERIFIED` because the Tesseract runtime check
  requires a network fetch in this environment.
- Draft PR #176 remains Draft; no merge, auto-merge, ruleset change, production
  load, or production migration was performed.

## Conclusion and next step

The requested 2x capacity increase cannot be honestly claimed. Stop modifying
application code until staging provides: a moderation-approved synthetic fixture
that remains governed by RLS, an Auth rate-limit-safe session preparation path,
working Realtime/query telemetry, and the matching application URL for browser
verification. Then rerun the exact workloads at the exact dataset and concurrency
conditions before selecting one evidence-backed bottleneck.
