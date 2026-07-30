# BookFlow AI Handoff

## Task title

capacity observability and frontend performance

## Release context

- Task ID: `20260731-capacity-observability`.
- Task: `capacity observability and frontend performance`.
- Branch: `codex/capacity-observability-release`.
- Base commit: `e977986fd262349fde4a6e666a45d99f65f8244f`.
- History: `.ai/history/20260731-capacity-observability.md`.
- A versioned Supabase migration is included and must pass staging before production.
- Protected recovery files and workflows are unchanged.

## Completed work

- Dynamically load infrequent seller storefront and bundle panels.
- Parallelize chat workspace trust-badge loading with profile and book requests.
- Document staging evidence requirements for p95/p99, slow SQL/RPC, and connection utilization.

## Verification

- TypeScript check passed.
- ESLint passed for all changed TypeScript files.
- Production build passed.
- Capacity load execution remains a separate staging operation after deployment.

## Next steps

1. Commit only the scoped database/RPC/client files and synchronized handoff metadata.
2. Run release preflight and the Staging Migration workflow for this exact SHA.
3. After successful staging evidence and approval, run Production Migration with the same SHA.

## Changed files

- `components/marketplace-app.tsx`
- `lib/marketplace/queries.ts`
- `scripts/check-capacity-optimization.mjs`
- `docs/CAPACITY_OBSERVABILITY.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260731-core-postgres-optimization.md`

## Risks and blockers

- The final production smoke proof depends on the merged SHA and the existing database baseline.

## AI follow-up

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Do not claim production implementation until the merged SHA and production smoke checks match.

## Commit

- Base commit: `e977986fd262349fde4a6e666a45d99f65f8244f`.
- Current implementation commit before final commit: `c7d4fa6bef917f2117fe479ae0e0315d515f534f`.
