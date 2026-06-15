# AI 交接歷史

- 任務：deploy Google OAuth login
- 執行者：codex
- 狀態：完成
- 基準 Commit：`5027513ba7f23abfc4cf349a86996e5a4d26fc41`
- 封存時間：2026-06-15T06:37:59.768Z

---
# BookFlow AI Handoff

## 目前目標

將 Google OAuth 快速登入完整發布到 BookFlow，包含前端、Supabase profile
migration、Google/Supabase OAuth 後台設定、PR 合併與正式站驗證。

## 重要背景與決策

- 工作在獨立分支 `codex/google-login`，基於最新 `origin/main`。
- Google 登入使用 Supabase `signInWithOAuth`，回到目前網站 origin。
- Google 不提供虎科系所，首次登入 profile 的系所暫存為「未設定」。
- 管理員使用 Google 登入仍需完成既有 8 位數 Email OTP 驗證。
- Client Secret 只存放於 Google Cloud 與 Supabase Dashboard，不進入 Git。
- 本次包含 timestamped migration，必須先經 Staging Migration，再進 Production Migration。
- 三個 recovery 保護檔案沒有修改，本提交不得加入 rollback 授權 trailer。

## 已完成

- 登入視窗新增「使用 Google 帳號繼續」按鈕、Google 圖示與載入狀態。
- 新增 Google OAuth redirect 與帳號選擇流程。
- OAuth 回站後沿用既有 session/profile 同步流程。
- 管理員 OAuth session 會自動寄送 OTP，且具 session 內防重複寄送。
- 新增 `handle_new_user` migration，支援 Google `full_name`、60 字限制與系所 fallback。
- 新增 Google Auth 靜態回歸檢查並掛入 `check:project`。
- README 與 setup health check 已加入 Google Cloud / Supabase 設定要求。

## 剩餘工作

1. Commit 並推送 `codex/google-login`。
2. 在 Google Cloud 建立 Web OAuth Client，設定正式站 origin 與 Supabase callback。
3. 在 Supabase 啟用 Google Provider，填入 Client ID/Secret。
4. 建立 PR，等待 Release Readiness、Staging Migration 與 Vercel Preview。
5. 合併後核准 Production Migration，等待正式 Vercel 部署。
6. 在正式站執行一般 Google 登入與管理員 OTP 路徑驗證。
7. 以 `/api/health/release` 與 release smoke 驗證正式 merge SHA。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `supabase/schema.sql`
- `supabase/google-oauth-profile-support.sql`
- `supabase/migrations/20260615000000_google_oauth_profile_support.sql`
- `scripts/check-google-auth.mjs`
- `scripts/run-project-checks.mjs`
- `scripts/setup-health-check.mjs`
- `package.json`
- `README.md`
- AI 交接狀態與歷史

## 驗證結果

- Google Auth checks：9/9 通過。
- Project checks：15/15 通過。
- TypeScript `tsc --noEmit` 通過。
- ESLint：0 errors，保留 2 個既有 `<img>` 效能 warnings。
- Next.js production build 通過。
- 本機瀏覽器確認 Google 按鈕、Email 分隔線與原登入流程正常。
- 本機瀏覽器 console 無 errors 或 warnings。
- `git diff --check` 通過。

## 風險或阻礙

- Google OAuth Client 與 Supabase Provider 尚未在遠端後台建立及啟用。
- migration 尚未套用到 staging 或 production。
- 本機 setup health check 的其他既有 secrets 未完整複製到獨立 worktree，
  不影響本次 build，但不能作為遠端環境已完成的證據。
- 真實 Google 登入只能在 Provider 啟用、migration 套用與 Preview/Production
  部署後驗證。

## 下一個 AI 的操作

1. 先完成 Google Cloud 與 Supabase Provider 設定。
2. 只在所有 PR checks 與 Staging Migration 成功後合併。
3. 合併後確認 Production Migration 與 Production Deployment Monitor 成功。
4. 用一般 Google 帳號驗證登入與 profile 建立，再驗證管理員 OTP。
5. 執行正式站 release smoke 並比對 `/api/health/release` commit。

## 最後基準 Commit

`5027513ba7f23abfc4cf349a86996e5a4d26fc41`
