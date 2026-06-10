# 虎科書流

單一校園使用的二手課本交易原型，以 Next.js、TypeScript 與 Supabase 製作。

## 開啟網站

在 Windows 檔案總管中雙擊 `start-bookflow.cmd`，並保持黑色視窗開啟。網站準備完成後會自動開啟 `http://localhost:3000`。

## 設定會員註冊與登入

會員流程是：

1. 註冊時填寫姓名、系所、Email 與密碼。
2. Supabase 寄出 8 位數註冊驗證碼。
3. 使用者完成 Email 驗證後建立會員資料。
4. 之後使用 Email 與密碼登入，不需要再次輸入驗證碼。
5. 忘記密碼時，可透過 Email 內的重設連結設定新密碼。

舊版曾使用 Email 驗證碼登入的會員不需要重新註冊。請在登入視窗選擇「舊會員建立密碼」，使用原 Email 收取連結並設定密碼；原有會員資料、刊登與交易會保留。

這會確認使用者能控制該 Email 信箱，但不代表他一定是本校學生。若學校提供校園 Email，可以再限制特定信箱網域。

### 1. 建立 Supabase 專案

1. 前往 Supabase 建立新專案。
2. 在 SQL Editor 執行 `supabase/schema.sql`。
3. 在 Project Settings → API 取得 Project URL 與 publishable/anon key。
4. 在專案根目錄建立 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的專案代碼.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的-publishable-或-anon-key
```

`schema.sql` 也會建立公開的 `book-images` Storage bucket 與安全規則。登入使用者只能上傳及管理自己資料夾內的圖片。

## 啟用刊登審核後台

先執行 `schema.sql`，再到 Supabase SQL Editor 執行：

```text
supabase/moderation.sql
```

這份 migration 會：

- 新刊登預設為待審核，只有通過後才公開顯示。
- 將 `ericpeng0604@gmail.com` 設為第一位管理員。
- 建立安全的通過、拒絕與角色設定函式。
- 讓管理員可將其他帳號設為審核員或管理員。

使用者修改已通過的刊登後，該書會重新進入待審核狀態。

## 啟用檢舉與停權系統

完成前述資料庫設定後，在 Supabase SQL Editor 執行：

```text
supabase/reports-and-suspensions.sql
```

這份 migration 可重複執行，會加入：

- 商品與使用者檢舉、重複檢舉防護。
- 管理員人工處理、商品隱藏與恢復。
- 會員唯讀停權與解除停權。
- 資料庫層的操作限制、站內通知及管理稽核紀錄。

停權會員仍可登入並查看既有交易，但不能刊登、修改商品或操作購買意願。

### 2. 啟用 Email 註冊驗證

1. 開啟 Supabase Dashboard → Authentication → Providers → Email。
2. 確認 Email Provider 與 Confirm email 已啟用。
3. 開啟 Authentication → Email Templates → Confirm signup。
4. 將範本改為包含 `{{ .Token }}`，例如：

```html
<h2>虎科書流註冊驗證碼</h2>
<p>你的 8 位數註冊驗證碼是：</p>
<h1>{{ .Token }}</h1>
<p>若不是你本人操作，請忽略這封信。</p>
```

註冊信必須使用 `{{ .Token }}`；若範本使用 `{{ .ConfirmationURL }}`，Supabase 會寄確認連結而不是網站內可輸入的驗證碼。

### 3. 設定忘記密碼回站網址

1. 開啟 Authentication → URL Configuration。
2. 將本機網址 `http://localhost:3000` 加入 Redirect URLs。
3. 部署後，將正式網站網址（例如 `https://你的網站.vercel.app`）也加入 Redirect URLs。
4. Password recovery 範本請保留 `{{ .ConfirmationURL }}`，讓使用者點擊連結回到網站設定新密碼。

網站會以目前所在網域作為密碼重設回站網址，因此本機與正式部署網址都需要列入 Supabase 允許清單。

### 4. 設定寄信服務

Supabase 內建寄信服務只適合測試，而且通常只能寄給專案團隊的 Email。要讓所有學生都收到驗證碼，需要在 Authentication → SMTP Settings 設定自訂 SMTP，例如 Resend、SendGrid 或 Amazon SES。

### 5. 重新啟動

關閉原本的黑色網站視窗，再重新雙擊 `start-bookflow.cmd`。網站就會啟用註冊、密碼登入與忘記密碼功能。

## 部署至 Vercel

部署時在 Vercel 加入：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

目前原型不包含付款、物流、站內聊天、評價或管理員後台。
