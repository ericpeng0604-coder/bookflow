# 書流 BookFlow

單一校園使用的二手課本交易原型，以 Next.js、TypeScript 與 Supabase 製作。

## 開啟網站

在 Windows 檔案總管中雙擊 `start-bookflow.cmd`，並保持黑色視窗開啟。網站準備完成後會自動開啟 `http://localhost:3000`。

## 設定 Gmail 驗證碼登入

登入流程是：

1. 使用者輸入 Gmail。
2. Supabase 寄出 8 位數一次性驗證碼。
3. 使用者在網站輸入驗證碼。
4. 驗證成功後建立登入狀態。

這會確認使用者能控制該 Gmail 信箱，但不代表他一定是本校學生。若學校提供校園 Email，可以再限制特定信箱網域。

### 1. 建立 Supabase 專案

1. 前往 Supabase 建立新專案。
2. 在 SQL Editor 執行 `supabase/schema.sql`。
3. 在 Project Settings → API 取得 Project URL 與 publishable/anon key。
4. 在專案根目錄建立 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的專案代碼.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的-publishable-或-anon-key
```

### 2. 啟用 Email OTP

1. 開啟 Supabase Dashboard → Authentication → Providers → Email。
2. 確認 Email Provider 已啟用。
3. 開啟 Authentication → Email Templates → Magic Link。
4. 將範本改為包含 `{{ .Token }}`，例如：

```html
<h2>書流登入驗證碼</h2>
<p>你的 8 位數驗證碼是：</p>
<h1>{{ .Token }}</h1>
<p>若不是你本人操作，請忽略這封信。</p>
```

必須使用 `{{ .Token }}`；若範本使用 `{{ .ConfirmationURL }}`，Supabase 會寄登入連結而不是驗證碼。

### 3. 設定寄信服務

Supabase 內建寄信服務只適合測試，而且通常只能寄給專案團隊的 Email。要讓所有學生都收到驗證碼，需要在 Authentication → SMTP Settings 設定自訂 SMTP，例如 Resend、SendGrid 或 Amazon SES。

### 4. 重新啟動

關閉原本的黑色網站視窗，再重新雙擊 `start-bookflow.cmd`。登入視窗就會啟用寄送驗證碼按鈕。

## 部署至 Vercel

部署時在 Vercel 加入：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

目前原型不包含付款、物流、站內聊天、評價或管理員後台。
