# BookFlow AI Handoff

## Task title

Campus-books concurrent capacity baseline and evidence-led optimization

## Release context

- Task ID: `20260731-campus-books-capacity`.
- Task: `Campus-books concurrent capacity baseline and evidence-led optimization`.
- Branch: `codex/campus-books-capacity-20260731`.
- Base commit: `7e2a4c59000392aa5d73a21289f777d0dcf5df30`.
- History: `.ai/history/20260731-campus-books-capacity.md`.
- This task is limited to local, isolated, or staging evidence. Production load testing and direct production migration are prohibited.
- Protected recovery files and workflows are unchanged.

## Current state

- The branch is isolated from `main` and is being rebased onto the current `origin/main` before continuing Draft PR review.
- Existing application observability documentation is a starting contract, not proof of current staging or production state.
- Added a guarded baseline runner for public reads, authenticated reads, purchase contention, and Realtime; it requires an explicit allowlisted non-production target.
- Added `docs/performance/baseline.md`, `optimization-log.md`, and `final-report.md` with the current evidence boundary.
- The latest `origin/main` contains a PostgreSQL migration from another PR; this branch does not add, apply, or claim production state for that migration.
- No staging or production load-test result is verified yet.

## Completed work

- Created a guarded, dependency-free capacity runner covering the required public, authenticated, purchase, contention, and Realtime workload families.
- Added reproducibility, safety, baseline, optimization-log, and final-report documentation without changing application behavior or database state.
- Verified the runner contract, refusal path, typecheck, lint, and test suite; external runtime capacity evidence remains `NOT VERIFIED`.

## Verification

- `NOT VERIFIED`: staging/local/isolated load execution.
- `NOT VERIFIED`: Supabase dashboard, slow-query, pool-connection, Sentry, and route/RPC duration evidence.
- `NOT VERIFIED`: authenticated browser flow, purchase race, Realtime, and RLS role probes.
- `NOT VERIFIED`: optimization improvement, two-times baseline capacity, project-check suite, and production build for this branch.
- `npm run check:capacity-load`: passed (17 checks).
- `npm test`: passed (31 tests, including two capacity-runner safety tests).
- `npm run typecheck`: passed.
- `npm run lint`: passed.

## Next steps

1. Obtain an explicitly verified non-production target and run the workload matrix with synthetic identities/data.
2. If a measured application bottleneck exists, make one minimal change and rerun the same matrix; otherwise stop with the blocker report.
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
- `.ai/history/20260731-campus-books-capacity.md`

## Risks and blockers

- No production or staging load target was available; all external capacity and database evidence remains `NOT VERIFIED`.
- PR base advanced after branch creation; the branch is being rebased onto the latest `origin/main` before continuing Draft PR review.

## AI follow-up

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Establish a reproducible baseline before changing application behavior.
3. Use only synthetic test identities/data and allowlisted non-production targets.
4. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or updating the Draft PR.
5. Do not claim production implementation, migration, or capacity without exact current evidence.

## Commit

- Base commit: `7e2a4c59000392aa5d73a21289f777d0dcf5df30`.
- Current implementation commit: `11c24daa45471b6d1def52310aff4ae808db1ff7`.
