# Campus-books optimization log

## 2026-07-31 — baseline tooling and evidence gate

### Hypothesis

No optimization hypothesis is accepted before workload-specific baseline
measurements identify one bottleneck. Existing capacity-related code and SQL
were inspected as source context only; they were not treated as deployed or
current database state.

### Change

- Added `scripts/capacity-load.mjs` with separate public, authenticated,
  purchase, contention, and Realtime workloads.
- Added allowlist/confirmation guards so the runner refuses an unverified or
  production-like target and does not print credentials.
- Added static contract checks and dependency-free refusal/help tests.
- Added baseline/report documents.
- No application, RLS, transaction, RPC, index, schema, or migration change
  was made in this round.

### Before data

- Staging/local target: `NOT VERIFIED`.
- Public/authenticated/purchase/Realtime latency and error metrics: `NOT VERIFIED`.
- Supabase slow-query, lock, pool-connection, and Realtime-limit metrics:
  `NOT VERIFIED`.

### Result

The runner contract passed 17 checks and its two safety tests passed. A real
load stage was not run because the available environment had no explicitly
verified non-production target. There is therefore no reproducible performance
improvement claim and no optimization to retain or revert.

### Next step

Obtain an explicitly identified local/isolated/staging target with a synthetic
dataset and test identities. Run each workload at increasing concurrency,
capture same-window Supabase/Sentry evidence, then select exactly one measured
bottleneck. If the limit is plan/quota/region/external service/test-machine
capacity, stop code changes and record that blocker.

## Failed or blocked experiments

- Existing `check:capacity` failed two origin/main static expectations. It was
  not treated as a capacity bottleneck and no speculative fix was made.
- `check:project` was blocked by a network-dependent Tesseract runtime fetch.
- Production build timed out after 180 seconds in the clean worktree.
- All external staging, authenticated, Realtime, database, and browser proof is
  `NOT VERIFIED`.
