# BookFlow AI Handoff

## 任務目標

Ship the administrator moderation workbench and keep the homepage market
switch free of the orange active underline.

## 目前狀態與背景

- Branch: `codex/admin-workbench-release`.
- Base commit: `25ea7b0882610add242671d305373e2fc1e0b5ca` (`origin/main`).
- Work is isolated from the dirty `codex/unify-market-switch-green` checkout.
- The admin page now has a persistent left workspace navigation, an overview
  with actionable counts, URL-persisted admin tabs, responsive mobile navigation,
  a listing review table, and a right-side listing detail drawer.
- Existing risk review queue behavior, private evidence loading, and review
  status policy remain unchanged.
- No database migration is required for this UI-only release.
- Protected rollback files and CODEOWNERS are unchanged.

## 已完成

- TypeScript: passed (`node node_modules/typescript/bin/tsc --noEmit`).
- ESLint: passed with temporary local compatibility plugins; those plugins are
  not part of the product diff.
- Project checks: passed (27/27).
- Admin workbench checks: passed (8/8).
- Risk warning checks: passed (23/23).
- Listing navigation and upload checks: passed.
- Home accessibility checks: passed (26/26).
- Production build: passed; 22 static pages generated.
- Local browser: public homepage loaded successfully. Admin interaction proof
  is pending because the available browser session is not signed in as an
  administrator.
- Staging and production migration: not applicable for this release.

## 下一步

1. Commit only the scoped UI, navigation, check, package script, and handoff
   files.
2. Push the branch and open a ready PR after checks are green.
3. Verify the merged SHA through Vercel, `/api/health/release`, and
   `release:smoke`.
4. Use a signed-in administrator session to verify the overview, workspace
   navigation, listing table, and listing detail drawer on production.

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `components/marketplace/navigation-state.ts`
- `package.json`
- `scripts/check-admin-workbench.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260715-admin-workbench-release.md`

## 驗證結果

- TypeScript、ESLint、專案檢查 27/27、風險檢查 23/23、首頁無障礙 26/26、管理工作台 8/8、Next production build 22 頁均已通過。
- 本地公開首頁可載入；正式網站管理員工作台互動尚待可用的管理員登入工作階段確認。

## 風險與注意事項

- Do not include the dirty checkout's student-card or unrelated changes.
- Do not change `.github/workflows/rollback-production.yml`,
  `.github/workflows/protect-rollback-workflow.yml`, or `.github/CODEOWNERS`.
- A local build or preview is not production proof.

## 下一位 AI 工作指引

1. 只 stage 本 handoff 列出的 release 檔案。
2. 建立 commit、push、開 PR，等待 required checks 綠燈後 merge。
3. 以合併 SHA 驗證 Vercel、`/api/health/release` 與 `release:smoke`。
4. 用管理員登入工作階段確認總覽、左側導覽、刊登表格與右側詳情抽屜。

## 相關 Commit

- Base: `25ea7b0882610add242671d305373e2fc1e0b5ca`。
- Feature commit: 待建立。
