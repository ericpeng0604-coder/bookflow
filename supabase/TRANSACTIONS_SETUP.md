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

## 2. Vercel 環境變數

站內通知不需要新增環境變數。Email 通知目前保持關閉：

```env
EMAIL_NOTIFICATIONS_ENABLED=false
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

## 3. 部署

將程式碼 Commit 並 Push 到 GitHub，等待 Vercel 自動部署。部署後登出再登入，
即可使用跨裝置購買意願、成交聯絡資料及站內通知。
