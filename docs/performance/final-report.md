# Campus-books capacity final report

Status: `NOT VERIFIED` / incomplete pending a non-production target.

## Outcome

The requested two-times stable-concurrency target was not claimed. This branch
contains a reproducible, guarded load-test runner and evidence/reporting
contract, but no real staging/local load stage was executed because the test
machine did not have an explicitly verified non-production Supabase target or
synthetic authenticated test identities.

## Verified

- An isolated branch was created from `origin/main` at
  `1f8ee884b695c5a642dafc7cb26e760382343165`.
- The original dirty checkout was preserved and was not reset or modified by
  this task.
- The load runner exposes separate public list/search/detail, authenticated
  profile/notification/conversation, purchase request, purchase-race, and
  Realtime workloads.
- The runner requires a target allowlist and explicit local/isolated/staging
  confirmation, and refuses mutating purchase tests without a second explicit
  confirmation.
- `npm run typecheck`, `npm test` (29 tests), `npm run check:capacity-load`, and
  the two capacity-load tests passed.
- No production load test, production migration, RLS weakening, auth bypass,
  transaction-protection change, or schema change was performed.

## Not verified

- Maximum stable concurrency, RPS, p50/p95/p99, timeout/429/5xx/error rate for
  every workload: `NOT VERIFIED`.
- Sentry logs, route/RPC duration, Supabase slow queries, pool/connection
  utilization, lock waits, Realtime limits, cache status, and same-window
  database evidence: `NOT VERIFIED`.
- Browser → Client → Server Route → Supabase → Response → UI verification for
  login, listings, search, detail, purchase race, chat, notifications, and RLS:
  `NOT VERIFIED`.
- Production build: `NOT VERIFIED` because the clean build exceeded the 180
  second command budget.
- Full project checks: `NOT VERIFIED` because the Tesseract runtime check
  required a network fetch unavailable in the restricted environment.
- Draft PR: pending final local review and publication of this scoped tooling
  branch; it must remain Draft and must not be merged or auto-merged.

## Blocker and next action

The current blocker is missing verified non-production runtime/test data, not a
proven application bottleneck. Supply a local/isolated/staging target label,
allowlisted host, synthetic dataset, synthetic access tokens, a synthetic
purchase listing, and a synthetic conversation. Then execute the commands in
`docs/performance/baseline.md`. If two optimization rounds fail to exceed
measurement noise, or the limit is Vercel/Supabase plan, quota, region,
external service, or test-machine capacity, stop modifications and preserve
the evidence as the conclusion.
