# 虎科書流

> 發布、Staging、資料庫 migration、正式站驗證與回滾流程，請以
> [`docs/RELEASE_WORKFLOW.md`](docs/RELEASE_WORKFLOW.md) 為準。

校園二手課本交易原型，以 Next.js、TypeScript 與 Supabase 製作。

## 本機開發

### 需求

- Node.js 20 或以上（建議 LTS）
- npm（隨 Node.js 安裝）

### 安裝與啟動

```text
npm install
cp .env.example .env.local   # Windows 可改為 copy .env.example .env.local
```

在 `.env.local` 至少填入：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的專案代碼.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的-publishable-或-anon-key
```

啟動開發伺服器（擇一）：

```text
npm run dev
```

瀏覽器開啟 `http://localhost:3000`。

Windows 也可雙擊 `start-bookflow.cmd` 啟動（會等待伺服器就緒後自動開啟瀏覽器）。若該腳本找不到 Node.js，請改用上面的 `npm run dev`。

### 本機驗證

建置與型別檢查：

```text
npm run lint
npx tsc --noEmit
npm run build
```

功能回歸腳本（不需連線正式資料庫）：

```text
npm run check:filters
npm run check:trade
npm run check:chat-state
npm run check:notifications
npm run check:push
npm run check:capacity
node scripts/check-refresh-guard.mjs
node scripts/check-trade-chat.mjs
node scripts/check-home-accessibility.mjs
node scripts/check-push-subscription-api.mjs
```

AI 交接完整性：

```text
npm run ai:check
```

環境與 migration 健檢（可選 `--no-network` 只做本機檢查）：

```text
npm run setup:check
npm run setup:check -- --no-network
```

## 一鍵 setup health check

在專案根目錄執行：

```text
npm run setup:check
```

它會檢查 Supabase、Resend、管理員 OTP、通知 Email 的環境變數與必要
migration，並以唯讀請求探測 Supabase/Resend 是否可用；不會寄信或建立
OTP。若只想檢查本機檔案與設定，可執行：

```text
npm run setup:check -- --no-network
```

輸出中的 `FAIL` 必須修正，`WARN` 是啟用相關功能前要補的設定，`TODO`
則是必須到 Supabase Dashboard 人工確認的 Auth redirect 與 Email Template。

## 開啟網站（Windows 快速啟動）

在 Windows 檔案總管中雙擊 `start-bookflow.cmd`，並保持黑色視窗開啟。網站準備完成後會自動開啟 `http://localhost:3000`。一般開發仍建議使用上一節的 `npm run dev`。

## 設定會員註冊與登入

會員流程是：

1. 註冊時填寫姓名、系所、Email 與密碼。
2. Supabase 寄出 8 位數註冊驗證碼。
3. 使用者完成 Email 驗證後建立會員資料。
4. 之後使用 Email 與密碼登入，不需要再次輸入驗證碼。
5. 忘記密碼時，可透過 Email 內的重設連結設定新密碼。

這會確認使用者能控制該 Email 信箱，但不代表他一定是本校學生。若學校提供校園 Email，可以再限制特定信箱網域。

### 1. 建立 Supabase 專案

1. 前往 Supabase 建立新專案。
2. 在 SQL Editor 依序執行 migration（順序很重要）：
   1. `supabase/schema.sql`
   2. `supabase/moderation.sql`
   3. `supabase/reports-and-suspensions.sql`
   4. `supabase/admin-login-verification.sql`
   5. `supabase/transactions-and-notifications.sql`
   6. `supabase/trade-messages.sql`（舊版聊聊；若已執行下一項可略過）
   7. `supabase/multi-party-orders-and-safe-chat.sql`（多人洽談、訂單、安全聊聊、收藏）
   8. `supabase/chat-notifications-and-contact-privacy.sql`
   9. `supabase/list-books-pagination.sql`（市集分頁）
   10. `supabase/listing-lifecycle.sql`（幽靈課本與賣家確認週期）
   11. `supabase/capacity-optimization.sql`（搜尋、未讀統計、對話分頁優化）
   12. `supabase/browser-push-and-30-day-confirmation.sql`（瀏覽器推播）
   13. `supabase/request-update-notification-dedupe.sql`（下訂通知 dedupe；可重複執行）
   14. `supabase/google-oauth-profile-support.sql`（Google 登入會員資料；可重複執行）
3. 若要回退生命週期排程（保留交易資料），執行 `supabase/listing-lifecycle-rollback.sql`；執行前請先移除 Vercel Cron。
4. 在 Project Settings → API 取得 Project URL 與 publishable/anon key。
5. 在專案根目錄建立 `.env.local`（可複製 `.env.example`）：

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

## 啟用管理員登入驗證碼

完成前述資料庫設定後，在 Supabase SQL Editor 執行：

```text
supabase/admin-login-verification.sql
```

管理員輸入正確密碼後，系統會透過 Supabase 寄送 8 位數 Email 驗證碼。伺服器會將驗證結果綁定到同一次密碼登入 session；每個新的登入 session 都必須重新驗證，單靠 Email 驗證碼不能繞過密碼取得管理員權限。未完成驗證時不能使用管理員或審核權限。

部署環境必須設定 `SUPABASE_SERVICE_ROLE_KEY`。此金鑰只可放在 Vercel Environment Variables，絕對不能加入 `NEXT_PUBLIC_` 前綴或寫入前端程式。

### 2. 啟用 Cloudflare Turnstile

Turnstile 是本專案目前唯一立即導入的 Cloudflare 功能；不需要搬移 DNS、Vercel、Supabase Storage，也不會代理網站流量。

1. 在 Cloudflare Dashboard → Turnstile 建立 widget，將本機、測試站與正式站 hostname 加入允許清單。
2. 將 Site Key 設定為 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`。Site Key 可出現在前端；不要把 Secret Key 寫入 Git、`.env.example` 或任何 `NEXT_PUBLIC_` 變數。
3. 在 Supabase Dashboard → Authentication → Bot and Abuse Protection → CAPTCHA 選擇 Cloudflare Turnstile，貼上 Secret Key。Secret 只保存在 Supabase Dashboard。
4. 本專案會把一次性 token 傳給 Email 註冊、密碼登入、註冊驗證碼重送、密碼重設與管理員 OTP 寄送；token 過期、重播或 hostname 不符時會拒絕。
5. 未設定 Site Key 時，本機仍可使用既有流程；但正式啟用 Supabase CAPTCHA 前，必須先把相同環境的 Site Key 部署完成。Turnstile 只負責機器人防護，不取代 Supabase Auth 授權與既有 API 限流。

請在 Supabase Dashboard → Authentication → Email Templates → Magic Link 將範本改為顯示 `{{ .Token }}`，不要使用 `{{ .ConfirmationURL }}`。驗證碼長度與有效期限沿用 Authentication 的 OTP 設定。

### 3. 啟用 Email 註冊驗證

1. 開啟 Supabase Dashboard → Authentication → Providers → Email。
2. 確認 Email Provider 與 Confirm email 已啟用。
3. 開啟 Authentication → Email Templates → Confirm signup。
4. 將範本改為包含 `{{ .Token }}`。可直接複製 [`supabase/email-templates/confirm-signup.html`](supabase/email-templates/confirm-signup.html) 的完整內容，避免信件只剩 8 位數字、沒有說明文字。

註冊信必須使用 `{{ .Token }}`；若範本使用 `{{ .ConfirmationURL }}`，Supabase 會寄確認連結而不是網站內可輸入的驗證碼。

### 4. 設定忘記密碼回站網址

1. 開啟 Authentication → URL Configuration。
2. 將本機網址 `http://localhost:3000` 加入 Redirect URLs。
3. 部署後，將正式網站網址（例如 `https://你的網站.vercel.app`）也加入 Redirect URLs。
4. Password recovery 範本請保留 `{{ .ConfirmationURL }}`，讓使用者點擊連結回到網站設定新密碼。

網站會以目前所在網域作為密碼重設回站網址，因此本機與正式部署網址都需要列入 Supabase 允許清單。

### 5. 啟用 Google 快速登入

1. 在 Google Cloud Console 建立或選擇專案，設定 OAuth consent screen。
2. 建立 OAuth Client ID，Application type 選擇 Web application。
3. 在 Authorized JavaScript origins 加入：
   - `http://localhost:3000`
   - 正式網站 origin，例如 `https://bookflow-green.vercel.app`
4. 開啟 Supabase Dashboard → Authentication → Providers → Google，複製該頁顯示的 Callback URL。
5. 將 Callback URL 加到 Google OAuth Client 的 Authorized redirect URIs。
6. 將 Google Client ID 與 Client Secret 填入 Supabase 的 Google Provider 並啟用。
7. 在 Supabase Authentication → URL Configuration，確認本機與正式網站都已加入 Redirect URLs。
8. 套用 `supabase/google-oauth-profile-support.sql`，讓首次 Google 登入使用 Google 顯示名稱建立會員資料。

Google 不提供虎科系所資料，因此首次登入會暫存為「未設定」，使用者可在個人資料中補選。管理員使用 Google 登入後仍必須完成 8 位數 Email 驗證碼，不會略過管理員二次驗證。

Client Secret 只填在 Google Cloud 與 Supabase Dashboard，不得加入 `.env.local`、前端程式碼或 Git。

### 5. 設定寄信服務

Supabase 內建寄信服務只適合測試，而且通常只能寄給專案團隊的 Email。要讓所有學生都收到驗證碼，需要在 Authentication → SMTP Settings 設定自訂 SMTP，例如 Resend、SendGrid 或 Amazon SES。

使用 Resend 免費方案時，先完成寄件網域的 SPF 與 DKIM 驗證，再將 Resend
提供的 SMTP host、port、帳號與 API key 填入 Supabase。金鑰只放在
Supabase Dashboard，不得寫入程式碼或 `NEXT_PUBLIC_` 環境變數。

若驗證碼改由虎科書流官方 Gmail 寄送，請先替該 Google 帳號啟用兩步驟驗證，
再建立專用的「應用程式密碼」。接著到 Supabase Dashboard →
Authentication → SMTP Settings 填入：

- Sender email：`huweibookflow@gmail.com`
- Sender name：`虎科書流`
- Host：`smtp.gmail.com`
- Port：`465`
- Username：`huweibookflow@gmail.com`
- Password：Google 產生的 16 位應用程式密碼，不是 Gmail 登入密碼

儲存後必須以非專案成員的測試信箱完成一次註冊與重新寄送驗證碼測試。
Gmail 地址與應用程式密碼只可保存在 Supabase SMTP Settings，不得加入
`.env`、GitHub、Vercel 或前端程式碼。`RESEND_FROM_EMAIL` 只控制一般通知信，
不會改變 Supabase Auth 的註冊驗證碼寄件者。

## 容量驗證

容量測試只能對本機或獨立 staging 執行。工具會逐步升載並回報吞吐量、
p50、p95、p99 與錯誤率：

```text
LOAD_TEST_CONFIRM=yes
LOAD_TEST_ALLOWED_HOSTS=你的-staging-project.supabase.co
LOAD_TEST_CONCURRENCY=200
LOAD_TEST_DURATION_SECONDS=900
LOAD_TEST_RAMP_STEPS=5
npm run load-test:marketplace
```

通過門檻為找書 p95 不超過 1.5 秒且錯誤率低於 1%。建立腳本或通過本機
建置不代表已證實 200 人容量；必須保留 staging 測試結果與資料庫資源數據。

### 5. 重新啟動

關閉原本的黑色網站視窗，再重新雙擊 `start-bookflow.cmd`。網站就會啟用註冊、密碼登入與忘記密碼功能。

## 部署至 Vercel

部署時在 Vercel 加入（完整清單見 `.env.example`）：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`（Cloudflare Turnstile Site Key；Secret Key 只放 Supabase CAPTCHA 設定）
- `APP_URL`（正式網站的 `https://` 網址，供通知郵件與推播連結）
- `SUPABASE_SERVICE_ROLE_KEY`（僅伺服器端，不可加 `NEXT_PUBLIC_`）
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `EMAIL_NOTIFICATIONS_ENABLED=true`（若要寄通知信）
- `CRON_SECRET`（至少 24 個隨機字元；Vercel Cron 會以此保護 `/api/cron/listing-lifecycle`）
- `WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY` / `WEB_PUSH_SUBJECT`（瀏覽器推播）
- `PUSH_DISPATCH_SECRET`（保護 `/api/cron/push`；Supabase `pg_cron` 排程應使用此 secret）
- `GEMINI_API_KEY`（只放在伺服器環境）
- `BOOK_OCR_AI_MODEL=gemini-2.5-flash`
- `BOOK_OCR_AI_DAILY_LIMIT=20`（每位登入使用者每日最多呼叫次數）

`vercel.json` 會每天執行一次刊登生命週期排程（`/api/cron/listing-lifecycle`）。瀏覽器推播 hourly 排程由 Supabase `pg_cron` 觸發（見 `supabase/browser-push-and-30-day-confirmation.sql`），需在 Supabase Vault 設定 dispatch URL 與 secret。排程負責建立站內與 Email 提醒、封存逾期販售中課本，以及處理封存滿一年的資料清理。洽談中的課本不會被自動封存。

課本封面辨識會先在使用者瀏覽器內執行免費 OCR。只有結果不可靠或欄位不足時，
才會將該張封面短暫傳送到伺服器端設定的 Gemini 視覺模型。BookFlow 不會另外
保存這次 AI 請求的圖片或原始模型回覆；辨識結果只填入可編輯草稿。Gemini
免費層有速率與每日額度限制，達到上限時會保留手動內容並讓弱 OCR 欄位維持空白。

## 一鍵回復正式網站上一版本

如果 AI 更新後讓網站發生問題，可以從 GitHub 安全回復上一個程式版本：

1. 開啟 GitHub 專案的 **Actions** 頁面。
2. 在左側選擇 **回復正式網站上一版本**。
3. 點擊右側的 **Run workflow**。
4. 保持分支為 `main`，勾選「我確認要將正式網站回復上一個程式版本」。
5. 再按一次綠色 **Run workflow** 按鈕。
6. 等待工作顯示綠色勾勾，Vercel 就會自動發布回復後的網站。

每次執行只回復一個程式版本。如果需要再往前一版，可在前一次工作完成後再次執行。還原會保留完整 Git 紀錄，不會刪除或回復 Supabase 的會員、書籍及交易資料。

### 第一次使用前的 GitHub 設定

1. 開啟 GitHub 專案的 **Settings → Actions → General**。
2. 找到 **Workflow permissions**。
3. 選擇 **Read repository contents and packages permissions**。
4. 按下 **Save**。

Repository 的預設 Actions 權限維持唯讀。一鍵還原與救援監控工作只在各自的工作流程中取得必要的 `contents: write`，不會將寫入權限開放給其他 Actions。

`.github/workflows/rollback-production.yml` 受到額外保護：一般 AI 指示禁止修改，CODEOWNERS 會標記負責人，而且未含明確授權標記的變更推送到 `main` 時，GitHub Actions 會自動恢復上一份內容。只有明確維護救援系統時，提交訊息才能加入 `Rollback-Workflow-Approved: true`。

如果工作停在建置檢查，代表上一版無法正常建置，因此不會推送或影響正式網站。如果顯示 main 已有新版本，代表檢查期間有人更新程式；重新執行一次即可，系統不會覆蓋那次更新。

目前原型不包含付款、物流或評價；已支援站內聊聊、購買意願、通知與瀏覽器推播。

## Codex 與 Cursor 工作交接

專案使用 `AI_HANDOFF.md`、`.ai/state.json` 與 `.ai/history/`，讓 Codex 和 Cursor 在不同工作階段共用目前進度。一次只讓一個 AI 工作，切換前應先完成交接並把 PR 合併到 `main`。

常用指令：

```text
npm run ai:status
npm run ai:claim -- codex "任務名稱"
npm run ai:claim -- cursor "任務名稱"
npm run ai:handoff -- codex cursor
npm run ai:handoff -- cursor codex
npm run ai:complete -- codex
npm run ai:check
```

第一次由 Codex 開啟本專案時，使用 `/hooks` 檢查並信任 `.codex/hooks.json`。Cursor 會透過 `.cursor/rules/ai-handoff.mdc` 自動讀取相同規則。

GitHub 的 `main` 規則應要求 PR 通過 **AI 交接完整性**，並禁止一般直接推送與強制推送。為維持緊急救援功能，只讓 GitHub Actions 繞過該規則；不要讓一般管理員或 AI 使用的帳號繞過。

第一次設定順序：

1. 先將功能透過獨立分支建立 PR，讓 GitHub 註冊必要檢查。
2. 到 **Settings → Rules → Rulesets** 新增針對預設分支的規則。
3. 啟用必須使用 PR、分支必須保持最新，並要求 **AI 交接完整性**、
   **Release Readiness**、**Staging Migration** 與 Vercel Preview；
   同時禁止 force push 與刪除分支。
4. 個人帳號不設定 bypass；若 bypass 清單可選 **GitHub Actions** GitHub App，將它設為 `Always allow`，讓正式網站救援工作流程仍能推送回復 commit。
5. Codex 使用 `ai/codex/任務名稱`，Cursor 使用 `ai/cursor/任務名稱`；目前 PR 合併後，下一個 AI 才能接手。

如果 bypass 清單沒有 GitHub Actions，先不要啟用「必須使用 PR」；否則現有一鍵回復工作流程會被擋住。需先另外為救援工作流程建立可被規則辨識的 GitHub App 或專用 deploy key，再啟用該規則。
