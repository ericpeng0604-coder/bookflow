# AI 交接歷史

- 任務：Implement chat read state, 30-day confirmations, and browser push
- 執行者：codex
- 狀態：完成
- 基準 Commit：`a9837d67195415409c03d45b0f18ef9bf5464e67`
- 封存時間：2026-06-13T05:53:54.114Z

---
# BookFlow AI Handoff

## 目前目標

Implemented chat read state, 30-day seller confirmation prompts, browser push
infrastructure, and the "確認下訂" purchase wording.

## 重要背景與決策

- Email remains disabled.
- The prompt cadence is 30 days, but automatic archival remains 120 days.
- Production database and deployment require separate explicit approval.

## 已完成

- Opening a conversation immediately clears its unread count in local state and
  calls `mark_conversation_read`; a failed write reloads the server state.
- Incoming messages in the open conversation remain read.
- Seller confirmation appears only after 30 days, then hides immediately after
  confirmation. Archival remains at 120 days.
- Lifecycle reminders now run at days 30, 60, 90, and 113.
- Browser Push subscription APIs, private subscription storage, Service Worker,
  VAPID delivery, retry handling, important-event filtering, and hourly Supabase
  dispatch scheduling are implemented.
- The first-login push card is shown once per user and the notification panel
  always contains the push on/off setting.
- Purchase action wording is now "確認下訂" with the seller-selection warning.
- Email notifications remain disabled in `.env.local`.

## 驗證結果

- TypeScript: passed.
- ESLint: passed with 8 pre-existing warnings and 0 errors.
- Production build: passed.
- Listing lifecycle checks: passed.
- Trade workflow checks: passed, 11/11.
- Browser Push structure checks: passed.
- Local browser smoke test: homepage and login modal loaded with no console errors.

## 剩餘工作

No remote database migration or production deployment was performed.

Before staging or production:

1. Set `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
   `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`,
   `WEB_PUSH_SUBJECT`, and `PUSH_DISPATCH_SECRET`.
2. Apply `supabase/browser-push-and-30-day-confirmation.sql`.
3. Add Supabase Vault secrets `bookflow_push_dispatch_url` and
   `bookflow_push_dispatch_secret`.
4. Run `npm run setup:check`, staging migration, staging browser tests, then
   obtain separate approval for production migration and deployment.

## 修改範圍

- `components/marketplace-app.tsx`
- `lib/marketplace/browser-push.ts`
- `lib/server/notification-push.ts`
- `supabase/browser-push-and-30-day-confirmation.sql`
- `scripts/setup-health-check.mjs`
- `scripts/check-browser-push.mjs`

## 風險或阻礙

- Required service role, cron, and VAPID values are not present locally.
- Supabase migration and Vault secrets are not applied remotely.
- ESLint reports eight existing warnings but no errors.

## 下一個 AI 的操作

1. Run `npm run setup:check` after the missing settings are supplied.
2. Apply and test the migration in staging.
3. Verify push permission, subscribe, unsubscribe, deep links, and invalid
   subscription cleanup in staging.
4. Request exact production migration and deployment approval.

## 最後基準 Commit

`a9837d67195415409c03d45b0f18ef9bf5464e67`
