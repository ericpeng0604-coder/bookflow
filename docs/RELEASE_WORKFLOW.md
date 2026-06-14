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
npm run check:all
npm run check:workflows
RELEASE_BASE_URL=https://example.com EXPECTED_COMMIT=<full-sha> npm run release:smoke
```

`release:smoke` verifies the homepage, `/api/marketplace/count`, and
`/api/health/release`.

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
