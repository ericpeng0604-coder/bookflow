# 2026-07-31 Capacity baseline evidence archive

## Scope

- Branch: `codex/campus-books-capacity-20260731`.
- Target: Supabase `BookFlow Staging` only; no production load or migration.
- Runner commit at public/auth/purchase execution: `85b2e55eed70c32d99756d3b0148b6505f426895`.

## Evidence

- Synthetic fixture: 500 Auth users/profiles, 6,975 retained books, 1,000
  purchase requests, 500 conversations, 5,000 messages, and 5,000 notifications.
- Synthetic books were forced pending by the current review trigger and marker
  queries returned no publicly visible synthetic books. RLS and moderation were
  not weakened.
- Public max stable tested stages were list 100, search 250, and detail 100;
  full metrics are in `docs/performance/baseline.md` and `.ai/artifacts/`.
- Authenticated endpoint probes at concurrency 100 used one synthetic session
  and had 0% HTTP errors. Preparing 500 sessions hit staging Auth rate limiting.
- Purchase probes returned 400 `Listing unavailable`; purchase capacity is not
  verified. Realtime remained not verified after the harness channel correction.
- Staging dashboard overview showed 14/60 peak connections, 4% CPU, 54% memory,
  44 slow queries, 0.00% API Gateway errors, and contradictory aggregate
  Database/Realtime error signals. Detailed reports lacked usable data.

## Decision

No application optimization was made. The blockers are staging Auth rate limits,
moderation fixture visibility, Realtime/reporting availability, and missing
same-window database/Sentry evidence. Further code changes require those external
conditions to be corrected first.
