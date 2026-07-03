# BookFlow AI Handoff

## 任務目標

部署 2026-07-04 要求的手機版市場與聊聊 UX 修正，並確認不會把舊分支差異或已合併的工具變更混進本次 release。

## 目前狀態與背景

- Branch: `codex/mobile-ux-release`.
- Base commit: `9e8b1eb702e9c3734502b79b71d4ad48f2c15974`.
- 這是 UI/runtime release，加上對應靜態回歸檢查。
- No database migration is required.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.
- 原始工作區位於舊分支；本 release worktree 已從最新 `origin/main` 重建，只套入手機 UX patch。

## 已完成

- 手機首頁搜尋框新增可點擊的右側箭頭。
- 「依課程快速找到課本」可開啟輕量提示並聚焦市場搜尋欄。
- 手機篩選下拉箭頭不再攔截 select 點擊。
- 上架表單將 `課程（選填）` 改為 `課堂名稱（選填）`，並加入問號說明。
- 書籍詳情頁加入既有收藏/取消收藏功能。
- 聊聊在使用者閱讀舊訊息時不強制捲到底，改顯示 `新訊息` 按鈕。
- 載入較早訊息會保留目前閱讀位置。
- 聊聊長訊息可安全換行，長輸入與常用語句在手機上可滑動。
- dashboard URL 會保存分頁與聊天室狀態，刷新後回到目前頁面。
- 賣家收到的訂單在確認/完成後仍有追蹤文案與聊聊入口。

## 下一步

1. Commit scoped files and this handoff trio.
2. Run `node scripts/release-preflight.mjs`.
3. Push branch and open PR.
4. Wait for required release gates.
5. Merge PR and verify production with exact merged SHA.

## 變更檔案

- `components/marketplace-app.tsx`
- `app/globals.css`
- `scripts/check-home-accessibility.mjs`
- `scripts/check-listing-navigation-ui.mjs`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/check-favorites.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260704-mobile-marketplace-chat-ux.md`

## 驗證結果

- `node scripts/check-home-accessibility.mjs`: passed in source worktree after mobile UX change.
- `node scripts/check-listing-navigation-ui.mjs`: passed in source worktree after mobile UX change.
- `node scripts/check-chat-listing-order-ux.mjs`: passed in source worktree after mobile UX change.
- `node --experimental-strip-types scripts/check-favorites.mjs`: passed in source worktree after mobile UX change.
- `node scripts/check-refresh-guard.mjs`: passed in source worktree after mobile UX change.
- `node scripts/check-trade-chat.mjs`: passed in source worktree after mobile UX change.
- `node scripts/check-notification-refresh.mjs`: passed in source worktree after mobile UX change.
- `tsc --noEmit`: passed via bundled Node and source worktree local TypeScript binary.
- Mobile Playwright smoke at `440x920`: hero search arrow, course guide button, guide visibility, and filter focus passed.
- `node scripts/run-project-checks.mjs`: passed in clean release worktree, 26/26 checks.
- `node node_modules/typescript/bin/tsc --noEmit`: passed in clean release worktree.
- `node node_modules/eslint/bin/eslint.js .`: passed in clean release worktree.
- `node node_modules/next/dist/bin/next build`: passed in clean release worktree.

## 風險與注意事項

- Do not include stale-branch deletions or already-merged release tooling/count API diffs.
- No protected recovery files are changed.
- `node_modules` in the clean worktree is a local junction for verification only and must not be committed.
- Production proof should use `/api/health/release` for the merged SHA before running `release-smoke`.

## 下一位 AI 工作指引

1. Keep the release scoped to the files listed above.
2. Do not touch protected recovery files or add the rollback approval trailer.
3. After commit, run `node scripts/release-preflight.mjs`.
4. Use direct GitHub status/release scripts instead of repeatedly opening dashboards.
5. After merge, verify `https://bookflow-green.vercel.app/api/health/release` reports the merged SHA and then run `release-smoke`.

## 相關 Commit

- Base commit: `9e8b1eb702e9c3734502b79b71d4ad48f2c15974`.
- Current implementation commit before final commit: `not committed yet`.
