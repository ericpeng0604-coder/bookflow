# BookFlow AI Handoff

## 任務目標

Deploy the homepage update for the secondhand books/items market switch.

## 目前狀態與背景

- Branch: `codex/secondhand-market-production`.
- Base commit: `af354eb6fbcc682185df3359284dcf0753be208b` (`origin/main`).
- Feature commit: `67af592`.
- This release contains only homepage UI, accessibility check, and one image asset.
- No database migration is required.
- No protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added a visible `二手書籍／二手物品` market switch.
- Made homepage headings, search labels, CTAs, empty states, and mobile menu copy mode-aware.
- Added the supplied secondhand-items hero image for the secondhand market.
- Kept the book market hero separate from the secondhand-items hero.

## 驗證結果

- Home accessibility checks: passed (26/26).
- Production build: passed (`EXIT_CODE=0`).
- Diff check: passed.
- Vercel Preview: pending on the release PR.
- Production deployment: pending PR merge and post-merge verification.

## 下一步

1. Wait for the release PR checks and resolve only release-gate failures.
2. Merge the clean PR after required checks pass.
3. Verify the Vercel production deployment commit and homepage market switch.
4. Run production smoke checks for release health.

## 風險與注意事項

- A Vercel Preview is not production proof.
- Do not include unrelated local files or pnpm-generated files in the release.
- Keep staging/database migration evidence separate; this UI release has no migration.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry in sync with the release commit.
2. Verify GitHub checks before merging; do not treat Preview as production.
3. Preserve all protected recovery files.

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `public/secondhand-items-hero.png`
- `scripts/check-home-accessibility.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260714-secondhand-market-homepage-release.md`

## 相關 Commit

- Base commit: `af354eb6fbcc682185df3359284dcf0753be208b`.
- Feature commit: `67af592`.
