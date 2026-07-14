# BookFlow AI Handoff

## 任務目標

Implement six marketplace fixes: handoff notification routing, duplicate-order
protection, desktop navigation visibility, mobile-safe OCR, price filtering,
and a collapsible mobile chat list.

## 目前狀態與背景

- Branch: `codex/six-mobile-marketplace-fixes`.
- Base commit: `f7bec0732571da7d72fc6c034f1730ca3f63ea7f` (`origin/main`).
- Feature commit: the six-fix implementation commit on this branch.
- Staging migration must pass before production approval.
- Production migration and production deployment remain pending.
- No protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added server-confirmed request loading and a unique active-request index.
- Added OCR-only image compression while preserving original upload files.
- Added non-destructive OCR merging for manually edited title/author/edition.
- Added inclusive `NT$500 以上` catalog filtering and a mobile chat rail toggle.

## 驗證結果

- Typecheck: passed.
- ESLint: passed for changed files.
- Production build: passed (`EXIT_CODE=0`).
- Six-fix, filter, OCR, image-search, and chat checks: passed.
- Mobile browser automation: NOT VERIFIED; Chromium executable is unavailable.
- Staging/production migration: pending separate database release approval.

## 下一步

1. Wait for PR CI and resolve only release-gate failures.
2. Verify the migration in staging.
3. Apply the migration to production through the separately approved path.
4. Merge the PR and verify the Vercel production deployment commit.
5. Run production smoke tests for release health and marketplace behavior.

## 風險與注意事項

- OCR input is compressed only for recognition; the original image remains the upload source.
- A SQL file, green build, or preview deployment is not production proof.
- Keep staging migration, production migration, and Vercel deployment evidence separate.

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

- Base commit: `f7bec0732571da7d72fc6c034f1730ca3f63ea7f`.
- Feature commit: the six-fix implementation commit on this branch.
