# BookFlow AI Handoff

## 任務目標

BookFlow cumulative marketplace cart and multi-item order release

## 目前狀態與背景

- Task ID: `20260723-bookflow-marketplace-complete-release`.
- Task: `Deploy complete marketplace cart and multi-item order changes`.
- Branch: `codex/marketplace-complete-20260723`.
- Base commit: `cb56051ddf3a64bd4c92683485258f570919f111`.
- History: `.ai/history/20260723-marketplace-complete-release.md`.
- This release includes the `20260723120000_multi_item_orders.sql` database migration.
- No workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`; this is not a rollback/recovery change.

## 已完成

- Removed duplicate market navigation entries while preserving the market switch.
- Hid the native file-input row, delayed book AI recognition UI until after upload, and moved helper copy into a floating tooltip with one recognition action.
- Applied the three meetup modes to books and secondhand listings, showing the location field only for the fixed-location mode.
- Added the complete multi-item cart and order flow, marketplace cache, market-switch guards, related mappers/types, regression checks, and the staging-gated database migration.

## 下一步

1. Apply the migration to staging and verify migration parity, RLS, and RPC probes.
2. Commit and push this clean release branch, then open a PR.
3. Wait for required GitHub checks and merge the PR.
4. Trigger `Release Production` with the exact merged `origin/main` SHA.
5. Verify `/api/health/release`, `release-smoke`, migration evidence, and the visible production release marker.

## 變更檔案

- `app/globals.css`, `components/marketplace-app.tsx`, `lib/marketplace/`, and `lib/types.ts`
- `package.json`, project checks, marketplace checks, and marketplace tests
- `supabase/migrations/20260723120000_multi_item_orders.sql`
- `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/20260723-marketplace-complete-release.md`

## 驗證結果

- Typecheck passed using the repository's available TypeScript runtime.
- Lint passed.
- Full test suite passed (22 tests).
- Project checks passed (34/34), including market cache, market switch, and multi-item order checks.
- Production build passed.
- Staging migration, parity, RLS, RPC probes, PR CI, production deployment, and production smoke remain to be recorded.
- Production is not verified until the merged full SHA is reported by `/api/health/release` and `release-smoke`.

## 風險與注意事項

- Production requires repository Vercel secrets and the protected `production-database` reviewer when migrations are detected.
- A failed deployment or smoke check must stop and report `NOT VERIFIED`; use the existing rollback workflow manually if needed.
- The dashboard is workspace-only and never receives production deployment secrets.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Preserve `.github/workflows/rollback-production.yml`, `.github/workflows/protect-rollback-workflow.yml`, and `.github/CODEOWNERS`.
4. Separate local, staging, deployment, release health, and smoke evidence; report `NOT VERIFIED` when any exact-SHA proof is missing.

## 相關 Commit

- Base commit: `cb56051ddf3a64bd4c92683485258f570919f111`.
- Current implementation commit before PR: `789c2cc73297713854fe2af28fbd884ab2114b1d`.
