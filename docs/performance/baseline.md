# Campus-books capacity baseline

Status: `NOT VERIFIED` for a staging/local/isolated runtime baseline.

This document records the reproducibility contract and the evidence boundary.
It does not treat README text, an old schema, a baseline migration, a prior
branch, or a deployed web commit as proof of the current Supabase state.

## Source and environment

| Field | Value |
| --- | --- |
| Branch | `codex/campus-books-capacity-20260731` |
| Baseline source commit | `1f8ee884b695c5a642dafc7cb26e760382343165` (`origin/main` when the runner branch was created) |
| Current branch base | `7e2a4c59000392aa5d73a21289f777d0dcf5df30` (`origin/main` after PR rebase) |
| Target environment | `NOT VERIFIED` — no non-production target was supplied or independently identified |
| Supabase project | `NOT VERIFIED` |
| Application URL | `NOT VERIFIED` |
| Dataset size | `NOT VERIFIED` — book/user/conversation counts were not available |
| Runtime | Node `v24.18.0`, npm `11.16.0` |
| Supabase CLI / Docker | `NOT VERIFIED` — not installed on the test machine |
| Credentials | No credentials, cookies, passwords, or access tokens were used |

## Reproduction commands

The runner requires an explicit non-production label, hostname allowlist, and
confirmation. It never prints the Supabase key or access tokens. Run one
workload per report line and keep the same commit, dataset, duration, timeout,
and concurrency while comparing experiments.

```powershell
$env:CAPACITY_TARGET_LABEL = "staging" # or local / isolated
$env:CAPACITY_SUPABASE_URL = "https://<staging-project>.supabase.co"
$env:CAPACITY_SUPABASE_ANON_KEY = "<staging-anon-key>"
$env:CAPACITY_ALLOWED_HOSTS = "<staging-project>.supabase.co"
$env:CAPACITY_CONFIRM = "yes"
$env:CAPACITY_DATASET_LABEL = "<synthetic-dataset-id>"
$env:CAPACITY_BOOK_COUNT = "<count>"
$env:CAPACITY_USER_COUNT = "<count>"
$env:CAPACITY_CONVERSATION_COUNT = "<count>"
$env:CAPACITY_CONCURRENCY = "10"
$env:CAPACITY_DURATION_SECONDS = "60"
$env:CAPACITY_OUTPUT_FILE = ".ai/artifacts/capacity-baseline.jsonl"
$env:CAPACITY_WORKLOAD = "public-list"
npm run capacity:load
```

Run separately with `public-search`, `public-detail`,
`authenticated-profile`, `authenticated-notifications`,
`authenticated-conversations`, `purchase-request`, `purchase-race`, and
`realtime`. Authenticated workloads require synthetic staging access tokens;
purchase workloads additionally require a synthetic listing and
`CAPACITY_CONFIRM_MUTATIONS=yes`. Never point these commands at production.

## Required metrics

The runner records environment label, hostname, commit, dataset labels,
concurrency, duration, timeout, total/success/failed requests, RPS, p50, p95,
p99, timeout count, HTTP 429 count, HTTP 5xx count, status breakdown, and HTTP
error rate. Application latency is not database evidence.

| Workload | Stable concurrency | RPS | p50 | p95 | p99 | timeout | 429 | 5xx | HTTP error rate | Database evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Public list | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Public search | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Public detail | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Authenticated profile | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Authenticated notifications | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Authenticated conversations | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Purchase request | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Purchase race | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Realtime subscription | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |

The conservative SLO is read p95 <= 750 ms, write p95 <= 1,500 ms, and HTTP
error rate < 1%. A stable-capacity claim additionally needs the same-window
Supabase Query Performance/`pg_stat_statements`, Supavisor pool utilization,
lock/timeout/connection-limit logs, and Realtime-limit evidence. Those external
observations are `NOT VERIFIED` here.

## Pre-change checks

- `npm ci --ignore-scripts`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 29 tests.
- `npm run check:capacity`: failed two existing origin/main assertions for chat badge parallelization and rare panel loading; no application change was made in response.
- `npm run check:project`: `NOT VERIFIED`; the Tesseract runtime attempted a network fetch and failed in the restricted environment.
- `npm run build`: `NOT VERIFIED`; the clean build did not finish within 180 seconds and was terminated by the command timeout.
- Staging/local load execution: `NOT VERIFIED`; no target was available.
- Sentry, route/RPC duration, Supabase slow queries, connection use, cache status, and browser-authenticated flows: `NOT VERIFIED`.
- The only available ignored local environment points to `bookflow-green.vercel.app`, which is production and was not used.
