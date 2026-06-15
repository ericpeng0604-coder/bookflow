# AI 交接歷史

- 任務：deploy chat feedback signup and official email
- 執行者：codex
- 狀態：完成
- 基準 Commit：`3a8eac4010762a844d55f442b2c3e1ae1f64ba22`
- 封存時間：2026-06-15T15:49:00.092Z

---
# BookFlow AI Handoff

## 目前目標

發布新用戶註冊、手機聊聊、聊天隱藏、意見回饋與官方 Gmail 寄信設定，
並在 staging 驗證資料庫遷移後部署到正式環境。

## 重要背景與決策

- 本次從已合併的 `codex/cursor-fixes-release` 建立獨立發布分支，提交後
  rebase 到最新 `origin/main`，保留主線新增的 Google 登入。
- 聊天刪除採用每位使用者各自隱藏已結束對話，不刪除交易或訊息資料。
- 意見回饋透過 Security Definer RPC 寫入，管理列表與處理功能限制為
  moderator。
- 新增 versioned Supabase migration，必須先通過 Staging Migration；
  Production Migration 需要另外核准。
- 三個 recovery 保護檔案沒有修改，本提交不得加入 rollback 授權 trailer。
- `.cursor/mcp.json`、舊驗證報告與 `output/` 不屬於本次發布，不會提交。

## 已完成

- 手機版聊聊新增返回列表控制，可收起目前訊息畫面。
- 登入／註冊視窗預設顯示新用戶註冊。
- 已結束聊天可由各使用者自行隱藏。
- 新增登入使用者意見回饋表單，以及 moderator 回饋管理與處理功能。
- 新增聊天偏好與回饋資料表、RLS、RPC、分頁聊天過濾與回饋速率限制。
- README 與環境範例更新為官方寄件帳號 `huweibookflow@gmail.com`。
- Supabase 自訂 SMTP 已使用官方 Gmail 設定，重設密碼測試信成功送達。
- staging 檢查新增 RPC 存在性及新增資料表匿名 RLS 驗證。

## 剩餘工作

1. 提交並 rebase 到最新 `origin/main`。
2. 推送分支並建立 PR。
3. 等待 AI handoff、Release Readiness、Staging Migration 與 Vercel Preview。
4. 合併後另行核准並執行 Production Migration。
5. 確認 Vercel Production 部署，並以 merge commit 執行 production smoke。

## 修改範圍

- `components/marketplace-app.tsx`、`app/globals.css`
- `lib/marketplace/queries.ts`、`lib/marketplace/mappers.ts`、`lib/types.ts`
- `supabase/migrations/20260615090000_chat_visibility_and_feedback.sql`
- `scripts/check-chat-visibility-and-feedback.mjs`、staging 與專案檢查入口
- `.env.example`、`README.md`、`AI_WORK_MANUAL.md`
- AI 交接狀態與歷史

## 驗證結果

- Chat visibility and feedback checks：8/8 通過。
- Project checks：15/15 通過。
- TypeScript `tsc --noEmit` 通過。
- 獨立乾淨 worktree 的 Next.js production build 通過，只有兩個既有
  `<img>` 效能 warnings。
- 手機瀏覽器確認驗證視窗預設為註冊，且沒有 console error。
- Gmail SMTP 重設密碼測試回傳 HTTP 200，信件成功送達。
- `git diff --check` 與 recovery 檔案差異檢查通過。

## 風險或阻礙

- 正式資料庫尚未套用本次 migration；PR 合併後需執行受保護的
  Production Migration。
- 應用程式在 migration 尚未套用時可載入，但隱藏聊天與回饋送出會失敗，
  因此正式資料庫遷移需緊接正式部署完成。
- 原工作區有共用 Next server 狀態，production build 證據來自獨立乾淨
  worktree。

## 下一個 AI 的操作

1. 只在所有 PR checks 成功後合併。
2. Production Migration 必須使用 `APPLY-PRODUCTION-MIGRATIONS` 明確確認。
3. 合併與遷移完成後，以 merge commit SHA 驗證 `/api/health/release`。
4. 驗證正式站首頁、市集數量、註冊預設畫面及新增 RPC 已存在。

## 最後基準 Commit

`3a8eac4`（建立本次工作分支時的 HEAD；提交後 rebase 到最新
`origin/main`）。
