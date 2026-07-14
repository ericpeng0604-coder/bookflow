# BookFlow AI Handoff

## 任務目標

Release completed-trade reviews, moderator-only risk analysis, and manually
approved positive trust badges without automatically blocking transactions.

## 目前狀態與背景

- Branch: `codex/trade-risk-warning-clean`.
- Base commit: `0f3919416ec56b16ab23469814dee308bb564045` (`origin/main`).
- Feature commit: the single commit ahead of `origin/main` on this branch.
- Staging migration is applied and schema/RLS/RPC checks passed.
- Production migration and production deployment remain pending.
- No protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added versioned `trade_reviews`, `risk_profiles`, `trust_badges`,
  `risk_policy_settings`, and audit logging.
- Added RLS and controlled RPCs for review submission, public approved badges,
  moderator risk data, badge review, and policy management.
- Added completed-trade review UI, public positive badges, and moderator risk
  panel with policy controls.
- Added regression checks and staging probes.

## 驗證結果

- Typecheck: passed.
- Lint: passed.
- Production build: passed.
- Project checks: `27/27` passed.
- Risk-warning checks: `15/15` passed.
- Staging migration: applied as
  `20260714102652_trade_reviews_and_risk_warning`.
- Staging tables, RLS, indexes, and RPC permissions: passed.

## 下一步

1. Wait for PR CI and resolve only release-gate failures.
2. Verify staging migration workflow and preview deployment.
3. Apply the same migration to production through the approved release path.
4. Merge the PR and verify the Vercel production deployment commit.
5. Run production smoke tests for the review, badge, and moderator flows.

## 風險與注意事項

- Risk scores, report evidence, and negative states are not public.
- High risk is moderator-only; transactions are not automatically blocked.
- A SQL file, green build, or preview deployment is not production proof.
- Keep production migration and Vercel deployment evidence separate.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry in
   sync with the release commit.
2. Verify GitHub checks before merging; do not treat a preview deployment as
   production proof.
3. Keep Supabase migration evidence separate from Vercel deployment evidence.

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `lib/marketplace/mappers.ts`
- `lib/marketplace/queries.ts`
- `lib/types.ts`
- `package.json`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/check-risk-warning.mjs`
- `scripts/check-staging.mjs`
- `scripts/run-project-checks.mjs`
- `scripts/verify.mjs`
- `supabase/migrations/20260714102652_trade_reviews_and_risk_warning.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260714-trade-risk-warning.md`

## 相關 Commit

- Base commit: `0f3919416ec56b16ab23469814dee308bb564045`.
- Feature commit: the single commit ahead of `origin/main` on this branch.
