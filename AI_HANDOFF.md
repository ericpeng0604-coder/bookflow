# BookFlow AI Handoff

## 任務目標

Deploy the marketplace risk-review queue and remove the orange underline from
the homepage market switch.

## 目前狀態與背景

- Branch: `codex/risk-review-queue-release`.
- Base commit: `a57f5857474445bdfaae06b04377e30642d69c0c` (`origin/main`).
- The release is isolated from the dirty `codex/unify-market-switch-green`
  checkout and contains no student-card verification changes.
- Migration `20260715142057_risk_review_queue.sql` is required and must pass
  staging before production database approval.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- The market switch keeps its green selected state but no longer renders the
  shared orange active underline.
- Risk moderation now defaults to a server-paginated high/medium-risk pending
  queue with status, risk-level, department, and name filters.
- Risk list rows omit raw evidence; moderator detail loading fetches evidence
  on demand in a right-side responsive drawer.
- Added shared `pending`, `viewed`, and `processed` review status with audit
  logging and moderator/admin-only RPC access.
- Added KPI summary, full-roster mode, pagination, mobile layout, and a
  collapsible risk-policy settings section.

## 驗證結果

- TypeScript: passed (`node node_modules/typescript/bin/tsc --noEmit`).
- ESLint: passed (`node node_modules/eslint/bin/eslint.js .`).
- Risk warning checks: passed (23/23).
- Listing navigation checks: passed.
- Production build: passed; 22/22 static pages generated.
- Diff check: passed.
- Local Supabase lint: `NOT VERIFIED`; local PostgreSQL was not running.
- Staging migration/RLS probes: `NOT VERIFIED`; staging credentials were not
  available in the isolated worktree.
- Vercel Preview: pending on the release PR.
- Production migration/deployment: pending PR merge and protected workflow
  approval.

## 下一步

1. Run release preflight and commit only the scoped files plus handoff metadata.
2. Push the branch and open a draft PR with the migration and focused checks.
3. Wait for required GitHub checks and staging migration evidence.
4. Move the PR out of draft, obtain the required production migration approval,
   and merge only after staging passes.
5. Verify the merged SHA through Vercel, `/api/health/release`, and
   `release:smoke`, including the risk queue and market-switch behavior.

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `lib/marketplace/mappers.ts`
- `lib/marketplace/queries.ts`
- `lib/types.ts`
- `scripts/check-risk-warning.mjs`
- `scripts/check-staging.mjs`
- `supabase/migrations/20260715142057_risk_review_queue.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260715-risk-review-queue-release.md`

## 風險與注意事項

- A Vercel Preview is not production proof.
- The migration changes the old zero-argument risk-list RPC to a paginated
  signature; staging must verify the exact PostgREST function arguments.
- Raw risk evidence remains moderator-only and is not part of list responses.
- Do not include the dirty checkout's student-card, pnpm-generated, or other
  unrelated files in this release.
- Preserve all protected recovery files.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry in
   sync with the release commit.
2. Run the exact staging and production migration workflows; do not infer
   database state from a green Vercel deployment.
3. Verify the merged commit, production migration, Vercel deployment,
   `/api/health/release`, and `release:smoke` before claiming completion.

## 相關 Commit

- Base commit: `a57f5857474445bdfaae06b04377e30642d69c0c`.
- Feature commit: recorded in Git history after the final handoff update.
