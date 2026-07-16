# AI Handoff Archive

- Task: simplify student card AI user messaging and coverage
- Actor: codex
- Status: complete
- Base commit: `97eeee5e2b50ba549106f61ad2f326228c12760f`
- Archived at: 2026-07-16T02:57:28.311Z

---
# BookFlow AI Handoff

## 任務目標

簡化學生證 AI 辨識對一般使用者的呈現，保留內部解析安全性與測試覆蓋，避免把 confidence、OCR 原文、AI 候選或學號解析細節暴露在使用者介面與瀏覽器 response。

## 目前狀態與背景

- Branch: `codex/student-verification-ux-test`。
- Base commit: `97eeee5e2b50ba549106f61ad2f326228c12760f`。
- 本批沒有新增資料庫 migration、GitHub workflow、部署設定或 protected recovery file。
- 原本混合且 dirty 的 checkout 保持 untouched；本批從乾淨的 `origin/main` worktree 實作。

## 已完成

- AI student-card API 不再回傳 confidence；瀏覽器 client 只接收可用學號。
- 使用者面板改用簡短成功／失敗訊息，不顯示 AI 候選、OCR 原文、confidence、系所、班別或年份解析細節。
- 上傳、重複提交、每日限制、登入失效與服務失敗改為安全且可行動的訊息，不直接顯示 Supabase 原始錯誤。
- 擴充學生驗證檢查，覆蓋有效、低信心、非學生證、無效學號、confidence 邊界、提示截斷與 fail-closed 行為。
- 將學生驗證檢查加入 project check suite。

## 下一步

1. 建立 PR 並等待 GitHub Release Readiness、AI handoff 與 Vercel Preview checks。
2. 本批無 migration；checks 通過後合併，確認正式 deployment commit 與 production smoke。

## 變更檔案

- `app/api/ai/student-card/route.ts`
- `components/marketplace-app.tsx`
- `lib/marketplace/student-card-ai.ts`
- `scripts/check-student-verification.mjs`
- `scripts/run-project-checks.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/` 本任務 handoff archive

## 驗證結果

- `node --experimental-strip-types scripts/check-student-verification.mjs`: passed。
- `node scripts/run-project-checks.mjs`: passed 28/28。
- `pnpm run typecheck`: passed。
- `pnpm run lint`: passed。
- `pnpm run build`: passed。
- `git diff --check`: passed。

## 風險與注意事項

- confidence 與原始 OCR 仍只在伺服器內部解析及資料庫交叉驗證流程使用，不應重新加入 public response 或一般使用者畫面。
- production database migration 不在本批範圍；依 release workflow 不需觸發 Production Migration。
- `pnpm run` 的自動依賴準備曾被本機 ignored-build policy 擋住；已用 `pnpm install --ignore-scripts --frozen-lockfile` 準備依賴，並以直接 Node command 取得目標檢查證據。

## 下一位 AI 工作指引

1. 保持 user-facing student-card 錯誤訊息為三類：照片問題、服務問題、登入／權限問題。
2. 不要把 provider payload、confidence、OCR 原文或 Supabase raw error 加回 UI 或 API response。
3. 開 PR 前執行 `node scripts/release-preflight.mjs`；等待 checks 使用 `release:watch-pr`，不要使用 noisy 的 `gh pr checks --watch`。

## 相關 Commit

- Base commit: `97eeee5e2b50ba549106f61ad2f326228c12760f`。
- Current implementation commit before final commit: not committed yet。
