# AI 交接歷史

- 任務：Implement listing lifecycle and inactive seller management
- 執行者：codex
- 狀態：完成
- 基準 Commit：`eb06be4550ff3fbea8db35194626dae25c6c4c03`
- 封存時間：2026-06-12T14:35:39.406Z

---
# BookFlow AI 交接

## 目前目標

部署市集通知跳轉、配對聊天室、購買意願常用語、收藏功能、低調化檢舉入口與註冊驗證信改善。

## 重要背景與決策

- 正式網站沿用 `https://bookflow.vercel.app`。
- 通知郵件連結只使用伺服器端 `APP_URL`，不再信任請求 `Origin`。
- 收藏目前儲存在使用者瀏覽器，不會跨裝置同步。
- 聊天室只允許已接受交易的買賣雙方存取。
- 復原工作流程與 CODEOWNERS 保護檔案未修改。
- 本次正式 Supabase 與部署操作均取得使用者明確授權。

## 已完成

- 收到購買意願通知會切換到「收到的意願」。
- 配對成功後可開啟即時聊天室，包含載入、傳送與錯誤狀態。
- 購買意願表單新增四句常用溝通文字。
- 檢舉入口移至更多選單與低調圖示按鈕。
- 收藏愛心可切換並新增「我的收藏」分頁。
- 註冊驗證信加入品牌、用途與安全說明文字。
- 修正通知郵件可信任網址、ESLint 設定與附件忽略規則。
- 正式 Supabase 已建立 `trade_messages`、RLS 與 Realtime 設定。
- 正式 Supabase 已更新 Confirm sign up Email Template。
- Vercel 已新增 `APP_URL=https://bookflow.vercel.app`。
- PR #3 已建立，Vercel Preview 建置成功。

## 剩餘工作

- 等待 AI 交接完整性檢查通過後合併 PR #3。
- 確認 Vercel Production 部署完成。
- 在正式網站以兩個測試帳號驗證完整配對與雙向聊天流程。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `app/api/notifications/email/route.ts`
- `lib/hooks/`
- `lib/marketplace/`
- `lib/types.ts`
- `supabase/trade-messages.sql`
- `supabase/list-books-pagination*.sql`
- `supabase/email-templates/confirm-signup.html`
- 品質檢查、文件與 AI 安全規則

## 驗證結果

- TypeScript `--noEmit` 通過。
- Next.js production build 通過。
- ESLint 為 0 errors、6 個既有 warnings。
- 篩選字串與編碼檢查通過。
- UTF-8 replacement character 掃描通過。
- 正式資料庫確認具備 `list_books_page` 與 `count_books_filtered`。
- 聊天室 migration 執行結果為 `Success. No rows returned`。
- Vercel Preview 狀態為 Ready。

## 風險或阻礙

- 收藏為瀏覽器本機資料，清除網站資料後會消失。
- 聊天室完整端到端驗證需要兩個已配對的正式測試帳號。
- `APP_URL` 需在新的 Production deployment 後才由伺服器程式讀取。
- 專案仍有 6 個不阻擋建置的既有 Lint warnings。

## 下一個 AI 的操作

1. 確認 PR #3 的必要檢查全部通過。
2. 合併 PR #3 到 `main`。
3. 等待並確認 Vercel Production deployment 為 Ready。
4. 開啟正式網站檢查首頁、註冊畫面與瀏覽器錯誤。
5. 有測試帳號時補做通知、收藏、配對與聊天室端到端驗證。

## 最後基準 Commit

`d51043aa5e7b594483402dc58a922539c8c35237`

## Release Update 2026-06-12

- PR #5 publishes the setup health check, independent hero search input,
  trade-chat quick phrases, chat notifications, and seller-controlled contact
  sharing.
- Production database still requires
  `supabase/chat-notifications-and-contact-privacy.sql`.
- Contact data is stored in the private `book_contact_preferences` table and is
  exposed only to an accepted buyer when the seller selects Email or LINE ID.
- Verified locally: TypeScript, filter checks, ESLint with zero errors, Next.js
  production build, and browser page load without runtime errors.
- Do not report these features as implemented online until PR #5 is merged,
  Vercel production is Ready, the migration is applied, and production behavior
  is checked.

## Placeholder Message Cleanup 2026-06-12

- Hide the legacy purchase-request placeholder message
  `通用語句提供選擇` from both buyer and seller transaction cards.
- Preserve real purchase-request messages and the chat quick-phrase buttons.
- Verified with TypeScript, ESLint with zero errors, UTF-8 validation, and a
  successful Next.js production build.

## Listing Lifecycle And Inactive Sellers 2026-06-12

- Added seller-level confirmation and activity tracking with 60, 83, 113, and
  120-day automation boundaries.
- Added independent `active`, `archived`, and `withdrawn` listing states.
  Negotiating or completed listings are not archived by the daily job.
- Added first-listing policy notice, seller confirmation controls, archived
  listing batch review, public search filtering, and public seller filtering.
- Added a protected daily Vercel Cron route, idempotent notification keys,
  queued Resend delivery with retries, one-year cleanup, and cleanup audit logs.
- Added `supabase/listing-lifecycle.sql` and the non-destructive emergency
  neutralization script `supabase/listing-lifecycle-rollback.sql`.
- Verified TypeScript, lifecycle boundary checks, filter checks, ESLint with
  zero errors, UTF-8 checks, protected recovery files, and a production build.
- This is implemented locally only. It is not online until the migration is
  explicitly applied, Vercel environment variables are configured, the branch
  is deployed, and production behavior is verified.
- Current setup health blockers: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
  and an explicit `EMAIL_NOTIFICATIONS_ENABLED` value. Resend credentials are
  also required before enabling notification Email.
