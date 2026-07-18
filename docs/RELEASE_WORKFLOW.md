# BookFlow release workflow

This document is the source of truth for releasing application and database
changes. A release is complete only after every applicable stage has evidence.

## Release states

1. **Local verified**: typecheck, lint, project checks, and production build pass.
2. **Pull request verified**: AI handoff, Release Readiness, Staging Migration,
   and Vercel Preview are successful.
3. **Staging verified**: versioned migrations are applied to the independent
   staging Supabase project and RPC/RLS probes pass.
4. **Production database applied**: the protected `Production Migration`
   workflow applies the approved migration ref after a separate approval.
5. **Production deployed**: Vercel reports the merged `main` commit as deployed.
6. **Production verified**: homepage, marketplace count, release health, and the
   expected commit pass the Production Deployment Monitor.

Do not describe an earlier state as a later one.

Monitoring and backup expectations live in `docs/MONITORING.md`.

## GitHub configuration

Create these GitHub Environments:

- `staging`: add `STAGING_DATABASE_URL`,
  `STAGING_SUPABASE_ANON_KEY`, and
  `STAGING_SUPABASE_SERVICE_ROLE_KEY` secrets; add
  `STAGING_SUPABASE_URL` as a variable.
- `production-database`: add `PRODUCTION_DATABASE_URL` and require a reviewer.

The `main` ruleset must:

- require a pull request with zero approving reviews for single-maintainer use;
- block deletion and non-fast-forward updates;
- require branches to be up to date before merge;
- require `AI 交接完整性`, `Release Readiness`, and `Staging Migration`.
- require the `Vercel` status when the repository's Vercel integration publishes
  that context.

The recovery deploy key or GitHub App must retain permission to push the
auditable rollback and recovery commits.

## Database migrations

All new migrations go in `supabase/migrations/` and use UTC timestamp names.
Use expand/contract migrations so the old and new application versions can both
run during deployment. Never remove or reinterpret data in the same release
that introduces the replacement path.

For existing databases, verify the legacy SQL state before repairing the
baseline migration history:

```text
supabase migration repair --status applied 20260614000000
```

Database changes must pass the Staging Migration workflow before the production
workflow is approved. Application rollback does not reverse database changes.
The production migration workflow checks out an explicit approved full commit
SHA and requires a successful `Staging Migration` run for that exact SHA. Use
the PR commit when the migration must run before the PR is merged; do not pass a
mutable branch name as `migration_ref`.

## Commands

```text
npm run release:local:quick
npm run release:version:patch
npm run release:local
npm run release:prepare
npm run release:watch -- --pr <pr-number-or-url>
npm run release:plan
npm run check:release-scope
npm run release:preflight
npm run check:all
npm run check:workflows
RELEASE_BASE_URL=https://example.com EXPECTED_COMMIT=<full-sha> npm run release:smoke
```

### Local release candidate flow

Run `npm run release:local:quick` whenever the local site reaches a testable
state. It runs the memory contract, regression tests, project checks, typecheck,
and lint without the production build. It records a report under
`.ai/artifacts/release-runs/` and stops at the first failed gate.

For every production deployment, run `npm run release:version:patch` once before
the final local gates. It increments the patch version by `0.0.1`, updates the
lockfile, and the footer receives the same version from `package.json`.

Before deployment, run `npm run release:local` without `--quick`. That final
pass includes the production build and is the only local report accepted by
`release:prepare`. Every report is tied to the changed-file content fingerprint,
so a later edit makes the previous evidence stale.

After the intended changes are committed on a clean release branch, run
`npm run release:prepare`. It rejects untracked files, protected recovery files,
possible secrets, unreadable text, mixed release scope, and stale local reports.
It creates a release-candidate manifest, but it never commits, pushes, merges,
or deploys. The manifest remains non-deployable until the PR, staging (when
applicable), Vercel, and production smoke gates pass for the same commit.

Use `npm run release:watch -- --pr <number-or-url>` for compact PR gate waiting.
After deployment, use `npm run release:watch -- --production <full-sha>` with
`RELEASE_BASE_URL` set to verify the exact deployed commit.

`release:smoke` verifies the homepage, `/api/marketplace/count`, and
`/api/health/release`.

When starting `Production Migration`, pass the exact 40-character commit SHA
as `migration_ref` and the successful `Staging Migration` workflow run ID as
`staging_run_id`. The production workflow rejects branch names, mismatched
staging runs, and unsuccessful staging evidence.

`check:release-scope` stops early when a narrow release is still sitting in a
dirty checkout, especially when observability files are mixed with unrelated
UI, SQL, workflow, or tooling changes.

`release:preflight` runs after the release commit and handoff update are ready
but before opening or merging the PR. It fails fast when a branch mixes commits
already applied to `main` with new commits, which can happen after a squash
merge, and when substantive code changes are missing the required
`AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/` updates.

## Low-token Codex path

When Codex is preparing or verifying a release, start with `npm run
release:plan` (or `node scripts/release-plan.mjs` when npm is unavailable). It
prints a short summary of the current branch, changed areas,
protected recovery-file risk, and the minimum gates required for the change.
If the active checkout is dirty and the intended release is small, move it into
a clean worktree before continuing. Then run `npm run check:release-scope`.
Before opening or merging the PR, run `npm run release:preflight` so stale
branch, mixed-scope, and handoff problems are caught locally instead of after
GitHub checks.
If `npm` is not available in the current shell, run the same helper directly
with the active Node runtime:

```text
node scripts/release-plan.mjs
node scripts/check-release-scope.mjs
node scripts/release-preflight.mjs
```

In Codex desktop on Windows, use the repository's `:codex` scripts when the
bundled Node runtime is needed:

```text
npm run ai:budget:codex
npm run release:plan:codex
npm run release:preflight:codex
npm run release:watch-pr:codex -- <pr-number-or-url>
RELEASE_BASE_URL=https://example.com EXPECTED_COMMIT=<full-sha> npm run release:smoke:codex
```

If the `:codex` wrapper is unavailable, use the active or bundled Node
executable, then run the same script directly:

```text
<bundled-node.exe> scripts/release-plan.mjs
<bundled-node.exe> scripts/release-preflight.mjs
<bundled-node.exe> scripts/release-watch-pr.mjs <pr-number-or-url>
```

Use the plan to choose the next proof point before opening browser dashboards,
large workflow logs, or repeated DOM snapshots. The low-token path reduces
exploration; it does not remove required evidence. Before a PR or merge, still
run the applicable local checks, workflow checks, staging migration, production
migration, and `release:smoke` gates described above.

When waiting for PR checks in Codex, use `release:watch-pr` instead of
`gh pr checks --watch`. The helper only prints compact status changes and final
failures, while `gh pr checks --watch` repeatedly dumps the full table and can
consume a large amount of context without adding proof.

## Recovery changes

The recovery files are:

- `.github/workflows/rollback-production.yml`
- `.github/workflows/protect-rollback-workflow.yml`
- `.github/CODEOWNERS`

Changes to these files require workflow structure tests and an isolated commit
with the exact trailer:

```text
Rollback-Workflow-Approved: true
```

The rollback workflow selects only unreverted commits from the first-parent
history of `main`. It validates the reverted tree, confirms `main` has not
moved, pushes an auditable revert commit, and waits for Vercel.
