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
   workflow completes after a separate approval.
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
- require `AI 交接完整性`, `Release Readiness`, `Staging Migration`, and the
  Vercel Preview status.

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

## Commands

```text
npm run release:plan
npm run check:release-scope
npm run release:preflight
npm run check:all
npm run check:workflows
RELEASE_BASE_URL=https://example.com EXPECTED_COMMIT=<full-sha> npm run release:smoke
```

`release:smoke` verifies the homepage, `/api/marketplace/count`, and
`/api/health/release`.

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
release:plan`. It prints a short summary of the current branch, changed areas,
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

In Codex desktop on Windows, `node` and `npm` may not be on `PATH`. Prefer the
Codex-safe package scripts first:

```text
pnpm run ai:budget:codex
pnpm run release:plan:codex
pnpm run release:preflight:codex
pnpm run release:watch-pr:codex -- <pr-number-or-url>
RELEASE_BASE_URL=https://example.com EXPECTED_COMMIT=<full-sha> pnpm run release:smoke:codex
```

If `pnpm` itself is not available, use the bundled Node executable shown by the
workspace dependency helper, then run the same script directly:

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
