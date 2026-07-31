# Campus-books capacity baseline

Status: `PARTIAL / NOT VERIFIED`.

This baseline was run only against the verified non-production Supabase project
`BookFlow Staging` (`yffcyktpwmeslydlbctb`). No production load or migration was
performed. The application URL, browser UI flows, same-window DB telemetry, and
500-session login capacity remain `NOT VERIFIED`.

## Source and fixture

| Field | Value |
| --- | --- |
| Branch | `codex/campus-books-capacity-20260731` |
| Source commit used by runner | `85b2e55eed70c32d99756d3b0148b6505f426895` |
| Target | Supabase `BookFlow Staging`, ref `yffcyktpwmeslydlbctb` |
| Application URL | `NOT VERIFIED` (direct Supabase API tests only) |
| Synthetic fixture | run `capacity-500-20260731-01` |
| Auth users / profiles | 500 / 500 |
| Books inserted and retained | 6,975 |
| Publicly visible synthetic books | 0 (`list_books_page` marker query returned `[]`) |
| Purchase requests / conversations | 1,000 / 500 |
| Messages / notifications | 5,000 / 5,000 |
| Runner | Node `v24.18.0`, timeout 10,000 ms unless noted |

The seed trigger correctly forced new books to `review_status=pending`; therefore
the 6,975 books are not a valid public-list dataset. No RLS or moderation rule
was weakened to make them visible. Public results below are staging's existing
visible data, not a claim about 6,975 public synthetic listings.

## Public workload results

The 30-second concurrency-1 runs warmed the path. The ladder used 10 seconds at
concurrency `5, 25, 100, 250, 500`. "Max stable tested" means the largest tested
stage with p95 <= 750 ms and HTTP error rate < 1%; it is not an extrapolated
maximum.

| Workload | Max stable tested | RPS at max stable | p50 | p95 | p99 | Timeout | 429 | 5xx | HTTP error rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Public list | 100 | 375.33 | 240.28 ms | 277.65 ms | 927.03 ms | 0 | 0 | 0 | 0% |
| Public search | 250 | 687.79 | 326.55 ms | 611.50 ms | 853.29 ms | 0 | 0 | 0 | 0% |
| Public detail | 100 | 398.57 | 241.20 ms | 258.96 ms | 452.12 ms | 0 | 0 | 0 | 0% |

At concurrency 500, list p95 was 1,864.05 ms with 0% HTTP errors, search had
309 timeouts and 4.375% HTTP error rate, and detail had 417 timeouts and
11.453% HTTP error rate. These are observed staging thresholds, not a verified
application bottleneck.

## Authenticated endpoint results

These runs reused one valid synthetic session at concurrency `1, 10, 100`; they
measure endpoint/RLS load, not login throughput. Preparing 500 sessions hit the
staging Auth `Request rate limit reached` response and is `NOT VERIFIED`.

| Workload | Max tested | RPS | p50 | p95 | p99 | Timeout | 429 | 5xx | HTTP error rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Profile | 100 | 403.61 | 237.34 ms | 254.32 ms | 480.34 ms | 0 | 0 | 0 | 0% |
| Notifications | 100 | 404.12 | 237.40 ms | 252.66 ms | 464.47 ms | 0 | 0 | 0 | 0% |
| Conversations | 100 | 389.49 | 244.04 ms | 273.50 ms | 544.06 ms | 0 | 0 | 0 | 0% |

## Purchase and Realtime

Purchase request and race probes returned HTTP 400 / `Listing unavailable`.
The current `enforce_book_review` trigger correctly makes service-role-seeded
listings pending, so these probes cannot prove purchase atomicity with the
synthetic listing. No security rule was bypassed. Purchase capacity is
`NOT VERIFIED`.

Realtime was first found to use an incorrect harness topic; the runner was
corrected to the app's `trade-chat:<conversationId>` topic. The corrected ladder
still returned 403/network failures, and one official Supabase client probe did
not reach a terminal status within 30 seconds. Realtime capacity is
`NOT VERIFIED`.

## Observability evidence

The staging dashboard overview (last 24 hours, not the exact load-test window)
showed: slow queries `44`, peak connections `14/60`, disk usage `25%`, disk IO
`1%`, memory `54%`, CPU `4%`, API Gateway errors `0.00%`, Database errors
`53.6%`, PostgREST `574 requests`, Auth warnings `19.4%`, and Realtime errors
`97.7%`. The detailed Auth and Realtime reports showed `No data`, and Query
Performance showed `Project not found`; same-window slow-query, lock, pool,
cache, Sentry, and route/RPC evidence is therefore `NOT VERIFIED`.

## Reproduction

Use the guarded runner with an anon key, never a service-role key:

```powershell
$env:CAPACITY_TARGET_LABEL = "staging"
$env:CAPACITY_SUPABASE_URL = "https://yffcyktpwmeslydlbctb.supabase.co"
$env:CAPACITY_ALLOWED_HOSTS = "yffcyktpwmeslydlbctb.supabase.co"
$env:CAPACITY_CONFIRM = "yes"
$env:CAPACITY_WORKLOAD = "public-list"
$env:CAPACITY_CONCURRENCY = "100"
$env:CAPACITY_DURATION_SECONDS = "10"
$env:CAPACITY_REQUEST_TIMEOUT_MS = "10000"
npm run capacity:load
```

Authenticated workloads require synthetic access tokens. Purchase workloads
also require `CAPACITY_CONFIRM_MUTATIONS=yes` and a synthetic listing that is
publicly visible through the current moderation workflow.

Raw non-secret metrics are in `.ai/artifacts/capacity-*.jsonl`. Access tokens,
passwords, service-role keys, and cookies were kept outside the repository.
