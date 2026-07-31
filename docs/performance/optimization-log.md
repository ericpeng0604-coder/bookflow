# Campus-books optimization log

## 2026-07-31 - Baseline and evidence gate

### Hypothesis and before data

No application bottleneck was accepted before measurement. The verified target
was Supabase `BookFlow Staging`; public list/search/detail were measured at
concurrency up to 500, authenticated endpoints at up to 100 using one session,
and purchase/Realtime probes were attempted. Same-window Supabase query plans,
locks, pool usage, Sentry, route/RPC duration, and cache status were unavailable.

### Minimal change

The load-test harness Realtime topic was corrected from the synthetic placeholder
topic to the app's actual `trade-chat:<conversationId>` topic after source-code
inspection showed the mismatch. No application, RLS, RPC, transaction, index,
schema, migration, or cache behavior was changed.

### Result

Public staging measurements showed the largest tested stable stages of list 100,
search 250, and detail 100, all below 1% HTTP error rate at their reported
stages. At 500, detail had 11.453% timeout/error rate and search had 4.375%;
list exceeded the p95 SLO without HTTP errors. Authenticated endpoint probes at
100 using one session remained below 1% errors. This is not a 2x improvement
claim because there is no pre-change application baseline and the synthetic
books were not public-visible.

### Failed or blocked experiments

- Preparing 500 login sessions hit staging Auth `Request rate limit reached`.
  This is an external Auth quota/rate-limit blocker; 500-session login capacity
  is `NOT VERIFIED`.
- Purchase request and race returned 400 `Listing unavailable` because the
  current review trigger correctly kept synthetic listings pending. No RLS or
  moderation bypass was attempted.
- Realtime remained 403/network-failing after the harness topic correction;
  the official client probe timed out. Realtime capacity is `NOT VERIFIED`.
- The staging observability overview had contradictory aggregate signals while
  detailed reports had no data/project-not-found. Same-window DB evidence is
  `NOT VERIFIED`.
- `check:observability` passed after network permission; local Sentry DSN and
  live staging Sentry confirmation remain `NOT VERIFIED`.

### Decision

Stop code optimization. The evidence currently points to staging Auth limits,
moderation fixture setup, Realtime/reporting availability, and missing same-window
telemetry—not to a proven app SQL/N+1/lock/fetch bottleneck. The next safe step
requires a staging-approved fixture path that preserves moderation/RLS, an Auth
rate-limit allowance or lower-rate session preparation, and working same-window
Supabase telemetry. Do not use production or weaken security to unblock it.
