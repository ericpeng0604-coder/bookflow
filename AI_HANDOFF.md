# BookFlow AI Handoff

## Task title

core PostgreSQL performance and RLS optimization

## Release context

- Task ID: `20260731-core-postgres-optimization-release`.
- Task: `core PostgreSQL performance and RLS optimization`.
- Branch: `codex/postgres-optimization-release-20260731`.
- Base commit: `1f8ee884b695c5a642dafc7cb26e760382343165`.
- History: `.ai/history/20260731-postgres-optimization-release.md`.
- A versioned Supabase migration is included and must pass staging before production.
- Protected recovery files and workflows are unchanged.

## Completed work

- Add a guarded seller-verification backfill that avoids unnecessary row updates.
- Add FK, RLS join/order, catalog, and risk moderation indexes.
- Keep catalog substring search semantics while adding a matching `pg_trgm` expression index.

## Verification

- Source migration diff is isolated to one SQL file plus synchronized release metadata.
- Migration application, staging RPC/RLS probes, and EXPLAIN verification remain required.
- Production migration and deployment remain separately gated by approval.

## Next steps

1. Commit only the scoped migration and synchronized handoff metadata.
2. Run release preflight and the Staging Migration workflow for this exact SHA.
3. After successful staging evidence and approval, run Production Migration with the same SHA.

## Changed files

- `supabase/migrations/20260731090000_core_postgres_optimization.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260731-postgres-optimization-release.md`

## Risks and blockers

- The migration must be applied through the repository workflow, not by treating the SQL file as remote state.
- Final production proof depends on the merged SHA, staging migration evidence, production approval, and health/smoke checks.

## AI follow-up

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Do not claim production implementation until the merged SHA and production smoke checks match.

## Commit

- Base commit: `1f8ee884b695c5a642dafc7cb26e760382343165`.
- Current implementation commit before final commit: `pending`.
