# Monitoring and Backup

This repo now has two layers of production monitoring:

1. `Production Deployment Monitor` verifies each successful production deploy.
2. `Production Uptime Smoke` runs every 15 minutes against the live site and
   compares the deployed commit with the current `main` commit.

Both workflows use `scripts/release-smoke.mjs`, which checks:

- `/`
- `/api/marketplace/count`
- `/api/health/release`

Manual production releases use `.github/workflows/release-production.yml`.
That workflow verifies the exact main SHA, applies migrations through the
protected approval path when needed, creates a targeted deployment, and runs
the same smoke checks. If source or release health does not match the expected
full SHA, report `NOT VERIFIED` and stop.

For human-readable local verification, `npm run dev` exposes the local Release
dashboard at `/release`. It is workspace-only and runs fixed source, contract,
test, typecheck, and lint checks; it is not a production deployment control
plane.

## Sentry

Set these environment variables in Vercel:

```text
NEXT_PUBLIC_SENTRY_DSN=<public DSN>
SENTRY_ORG=<org slug>
SENTRY_PROJECT=<project slug>
SENTRY_AUTH_TOKEN=<token, optional but recommended for source maps>
```

Notes:

- `NEXT_PUBLIC_SENTRY_DSN` is enough to start capturing browser, server, and App Router render errors.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` enable source map upload during build. If they are absent, error capture still works but stack traces are less readable.

## External Uptime Service

The scheduled GitHub workflow gives repository-owned uptime evidence, but it is not an out-of-band monitor. Add one external probe as well:

- Better Stack or UptimeRobot
- URL: `https://bookflow-green.vercel.app/api/health/release`
- Expect: HTTP `200` and JSON field `status: "ok"`

This gives alerting even if GitHub Actions is degraded.

## Database Backup

Application rollback does not restore database state. Keep database backup outside the repo and verify it in Supabase:

1. Enable daily backups or PITR on the production project.
2. Record retention period and restore owner in the team runbook.
3. Test one non-production restore before relying on it for incidents.

Minimum operator checklist:

- Confirm backup retention window
- Confirm latest successful backup timestamp
- Confirm restore target and owner
- Confirm schema migrations are still tracked in `supabase/migrations/`
