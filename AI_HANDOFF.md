# BookFlow AI Handoff

## Task title

Campus-books concurrent capacity baseline and evidence-led optimization

## Release context

- Task ID: `20260731-campus-books-capacity`.
- Task: `Campus-books concurrent capacity baseline and evidence-led optimization`.
- Branch: `codex/campus-books-capacity-20260731`.
- Base commit: `7e2a4c59000392aa5d73a21289f777d0dcf5df30`.
- History: `.ai/history/20260731-capacity-baseline-evidence.md`.
- This task is limited to local, isolated, or staging evidence. Production load testing and direct production migration are prohibited.
- Protected recovery files and workflows are unchanged.

## Current state

- The branch is isolated from `main` and has been rebased onto the current `origin/main` before continuing Draft PR review.
- Existing application observability documentation is a starting contract, not proof of current staging or production state.
- Added a guarded baseline runner for public reads, authenticated reads, purchase contention, and Realtime; it requires an explicit allowlisted non-production target.
- Added `docs/performance/baseline.md`, `optimization-log.md`, and `final-report.md` with the current evidence boundary.
- The latest `origin/main` contains a PostgreSQL migration from another PR; this branch does not add, apply, or claim production state for that migration.
- Staging API baseline evidence is now captured; application URL, browser UI
  proof, same-window database telemetry, and 500-session login capacity remain
  `NOT VERIFIED`.

## Completed work

- Created a guarded, dependency-free capacity runner covering the required public, authenticated, purchase, contention, and Realtime workload families.
- Added reproducibility, safety, baseline, optimization-log, and final-report documentation.
- Populated only the verified staging project with synthetic data: 500 users,
  6,975 retained books, 1,000 purchase requests, 500 conversations, 5,000
  messages, and 5,000 notifications.
- Public API evidence was captured at list/search/detail concurrency stages;
  authenticated endpoint evidence used one synthetic session. The 500-session
  Auth preparation hit `Request rate limit reached`.
- Corrected the Realtime harness topic to match the app's
  `trade-chat:<conversationId>` channel. No app, RLS, RPC, transaction, index,
  schema, or migration change was made.
- Verified `check:capacity-load` and `check:observability`; same-window DB,
  Sentry, browser, purchase-race, and Realtime evidence remains incomplete.

## Verification

- Public max stable tested stages: list 100, search 250, detail 100; see `docs/performance/baseline.md` for p50/p95/p99/RPS and 500-stage errors.
- Authenticated profile/notification/conversation endpoint probes at concurrency 100 had 0% HTTP errors with one session; 500-session login capacity is `NOT VERIFIED`.
- Purchase request/race returned 400 `Listing unavailable` because the moderation trigger correctly kept synthetic books pending; purchase atomicity is `NOT VERIFIED`.
- Realtime remained `NOT VERIFIED` after the harness topic correction; the official client probe timed out.
- Supabase overview signals were captured, but detailed reports had no data or project-not-found; same-window slow-query, pool, lock, cache, route/RPC, and Sentry evidence is `NOT VERIFIED`.
- `NOT VERIFIED`: optimization improvement, two-times baseline capacity, browser verification, and project-check suite for this branch.
- `npm run build`: passed after the evidence/docs update; only existing workspace-root and webpack cache warnings were emitted.
- `npm run check:capacity-load`: passed (17 checks).
- `npm test`: passed (31 tests, including two capacity-runner safety tests).
- `npm run typecheck`: passed.
- `npm run lint`: passed.

## Next steps

1. Stop application optimization until staging supplies a moderation-approved synthetic fixture path, Auth rate-limit-safe session preparation, working Realtime/query telemetry, and an application URL for browser verification.
2. If those blockers are removed, rerun the exact matrix before selecting one measured bottleneck; otherwise preserve the blocker report.
3. Keep the Draft PR reviewable; do not merge, auto-merge, deploy, or apply a production migration.

## Changed files

- `package.json`
- `scripts/capacity-load.mjs`
- `scripts/check-capacity-load.mjs`
- `tests/capacity-load.test.mjs`
- `docs/performance/baseline.md`
- `docs/performance/optimization-log.md`
- `docs/performance/final-report.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260731-capacity-baseline-evidence.md`

## Risks and blockers

- No production load was run. Staging Auth rate limits, moderation fixture visibility, Realtime/reporting failures, and missing same-window telemetry block a complete 500-user baseline and any 2x claim.
- PR base advanced after branch creation; the branch was rebased onto the latest `origin/main` and its local/CI gates were rerun.

## AI follow-up

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Establish a reproducible baseline before changing application behavior.
3. Use only synthetic test identities/data and allowlisted non-production targets.
4. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or updating the Draft PR.
5. Do not claim production implementation, migration, or capacity without exact current evidence.

## Commit

- Base commit: `7e2a4c59000392aa5d73a21289f777d0dcf5df30`.
- Current implementation commit: pending (working tree contains the evidence/docs update and Realtime harness topic correction).
