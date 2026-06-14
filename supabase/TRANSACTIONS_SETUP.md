# 交易、通知與隱私補強設定

## 1. 執行資料庫更新

在 Supabase Dashboard 開啟 SQL Editor，建立新的查詢，貼上並執行：

```text
supabase/transactions-and-notifications.sql
```

看到 `Success. No rows returned` 即完成。這份 SQL 可以重複執行。

雙方配對後若要啟用站內聊天室，接著執行：

```text
supabase/trade-messages.sql
```

聊天室只允許已接受交易的買賣雙方讀取與傳送訊息。

接著執行：

```text
supabase/chat-notifications-and-contact-privacy.sql
supabase/multi-party-orders-and-safe-chat.sql
```

這會為聊天訊息建立站內通知，並把額外聯絡方式改成由賣家逐筆刊登選擇：
不分享、帳號 Email，或 LINE ID。買家的 Email 不會自動公開。

最後執行：

```text
supabase/listing-lifecycle.sql
supabase/browser-push-and-30-day-confirmation.sql
supabase/request-update-notification-dedupe.sql
```

若生命週期排程需要緊急停用，先移除 Vercel Cron，再執行：

```text
supabase/listing-lifecycle-rollback.sql
```

回復腳本只中止自動封存並恢復公開狀態，不刪除生命週期欄位、交易或稽核紀錄。

這會加入賣家 30 天確認提示、60/90/113 天追蹤提醒、120 天未確認封存、
逐本恢復與一年後清理所需的資料結構及 RPC。既有課本會以 migration
執行時間作為首次確認時間，不會在上線當天被封存。
最後兩個 migration 會加入瀏覽器推播訂閱、30 天週期提醒與每小時推播派送，
並將同一筆購買意願的重複修改通知合併為一則。

## 2. Vercel 環境變數

站內通知不需要新增環境變數。Email 通知目前保持關閉：

```env
EMAIL_NOTIFICATIONS_ENABLED=false
APP_URL=https://你的-vercel-網址
SUPABASE_SERVICE_ROLE_KEY=Supabase 的 secret/service_role key
CRON_SECRET=至少24個隨機字元
WEB_PUSH_VAPID_PUBLIC_KEY=VAPID public key
WEB_PUSH_VAPID_PRIVATE_KEY=VAPID private key
WEB_PUSH_SUBJECT=mailto:管理員信箱
PUSH_DISPATCH_SECRET=至少24個隨機字元
```

取得自有網域並完成 Resend 驗證後，再加入：

```env
SUPABASE_SERVICE_ROLE_KEY=Supabase 的 secret/service_role key
RESEND_API_KEY=Resend API key
RESEND_FROM_EMAIL=虎科書流 <notifications@你的網域>
EMAIL_NOTIFICATIONS_ENABLED=true
```

`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel Environment Variables，不能使用
`NEXT_PUBLIC_` 前綴，也不能提交到 GitHub。

另外在 Supabase Vault 建立：

```text
bookflow_push_dispatch_url=https://你的-vercel-網址/api/cron/push
bookflow_push_dispatch_secret=與 PUSH_DISPATCH_SECRET 相同
```

## 3. 部署

將程式碼 Commit 並 Push 到 GitHub，等待 Vercel 自動部署。部署後登出再登入，
即可使用跨裝置購買意願、成交聯絡資料及站內通知。
