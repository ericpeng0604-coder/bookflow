# BookFlow AI Handoff

## 任務目標

修復響應式聊聊頁：桌機雙欄版面不可被長字串撐破，手機點擊返回聊聊後要回到聊天室列表，不能被最後一次聊天室恢復邏輯立即重新打開。

## 目前狀態與背景

- Branch: `codex/mobile-chat-back-fix`。
- Base: `64ef6f3d2bd1814ec35b2b0834211f10cf0fd4c8` (`origin/main`)。
- Target: `https://bookflow-green.vercel.app`。
- 這是 Runtime/UI 與靜態 regression checks 變更，不含資料庫 migration。
- 未修改 workflow、rollback、recovery 或 `.github/CODEOWNERS`。
- 原始 dirty checkout 的學生驗證、OCR 與其他未提交修改已排除。

## 已完成

- 新增 `closeConversation`，返回時先清除 `lastChatStorageKey(currentUser.id)`，再清除目前選取聊天室，避免 effect 立即恢復原聊天室。
- 聊天標題 flex 子項允許縮小，說明文字超長時截斷，避免桌面版聊天欄撐破容器。
- 更新兩個聊天靜態檢查，改為驗證新的返回行為 contract。
- 將本次發現的 stale static-check 規則記錄到 `AI_WORK_MANUAL.md`。

## 下一步

1. Push branch、建立 PR 並等待必要 checks。
2. Merge PR 後以 `/api/health/release` 驗證 Vercel production commit。
3. 用 merged SHA 執行 release smoke 並重新確認正式頁面。

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/check-chat-visibility-and-feedback.mjs`
- `AI_WORK_MANUAL.md`
- `.ai/state.json`
- `.ai/history/20260716-mobile-chat-back-fix-release.md`

## 驗證結果

- `pnpm run typecheck`: passed。
- `pnpm run lint`: passed。
- `pnpm run check:project`: passed (29/29)。
- `pnpm run check:chat-listing-order-ux`: passed (23/23)。
- `node scripts/check-chat-visibility-and-feedback.mjs`: passed (9/9)。
- `pnpm run build`: passed，22/22 static pages generated。
- UTF-8 / replacement-character scan: passed (8/8 files)。
- 修復前 production `/api/health/release` 回報 commit `64ef6f3d2bd1814ec35b2b0834211f10cf0fd4c8`。
- In-app browser 沒有可接管的登入分頁，因此登入後聊天實際點擊流程仍標記為 NOT VERIFIED。

## 風險與注意事項

- 本次沒有資料庫變更，不需 migration。
- Production deployment 必須以 PR merge 後的 commit 驗證，不可用 preview 當成 production proof。
- 不可把原始 dirty checkout 的無關檔案帶入本 PR。
- 不修改 rollback/recovery workflows 或 `.github/CODEOWNERS`。

## 下一位 AI 工作指引

1. 只在本 clean worktree 處理本 release，保留原始 checkout 的未提交修改。
2. 執行 `node scripts/check-release-scope.mjs`、`node scripts/ai-collaboration.mjs check-ci origin/main HEAD` 與 `node scripts/release-preflight.mjs`。
3. PR checks 通過並 merge 後，以 `/api/health/release` 的 `commit` 對照 `EXPECTED_COMMIT`，再執行 release smoke。
4. 保持 `AI_HANDOFF.md`、`.ai/state.json` 與 matching history entry 同步。

## 相關 Commit

- Base commit: `64ef6f3d2bd1814ec35b2b0834211f10cf0fd4c8`。
- Current fix commit: final commit on this branch; verify with `git rev-parse HEAD`。
