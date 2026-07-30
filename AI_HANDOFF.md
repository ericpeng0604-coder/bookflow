# BookFlow AI Handoff

## Task title

core PostgreSQL performance and RLS optimization

## Release context

- Task ID: `20260731-core-postgres-optimization`.
- Task: `core PostgreSQL performance and RLS optimization`.
- Branch: `codex/core-postgres-optimization-release`.
- Base commit: `9ed43fbfa7732064337ca28be8429c7d81c2f6ca`.
- History: `.ai/history/20260731-core-postgres-optimization.md`.
- A versioned Supabase migration is included and must pass staging before production.
- Protected recovery files and workflows are unchanged.

## Completed work

- Added seller verification projection, synchronization triggers, public catalog indexes, and RLS scalar-subquery improvements.
- Reworked the risk moderation RPC and client to keyset pagination with first-page total count only.
- Added daily seller projection recomputation to the listing lifecycle cron.

## Verification

- TypeScript check passed.
- ESLint passed for all changed TypeScript files.
- Production build passed.
- Remote staging and production migration are pending this release candidate.

## Next steps

1. Commit only the scoped database/RPC/client files and synchronized handoff metadata.
2. Run release preflight and the Staging Migration workflow for this exact SHA.
3. After successful staging evidence and approval, run Production Migration with the same SHA.

## Changed files

- `app/api/cron/listing-lifecycle/route.ts`
- `components/marketplace-app.tsx`
- `components/marketplace/use-marketplace-workspace.ts`
- `lib/marketplace/queries.ts`
- `supabase/migrations/20260731090000_core_postgres_optimization.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260731-core-postgres-optimization.md`

## Risks and blockers

- Staging/production database credentials are held by GitHub environments; local direct migration is not used.
- Production migration and exact-SHA application proof remain pending until staging succeeds.

## AI follow-up

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Do not claim production implementation until the merged SHA and production smoke checks match.

## Commit

- Base commit: `9ed43fbfa7732064337ca28be8429c7d81c2f6ca`.
- Current implementation commit before final commit: `pending`.
