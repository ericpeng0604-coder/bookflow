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

## 啟用管理員登入驗證碼

完成前述資料庫設定後，在 Supabase SQL Editor 執行：

```text
supabase/admin-login-verification.sql
```

管理員輸入正確密碼後，系統會透過 Supabase 寄送 8 位數 Email 驗證碼。伺服器會將驗證結果綁定到同一次密碼登入 session；每個新的登入 session 都必須重新驗證，單靠 Email 驗證碼不能繞過密碼取得管理員權限。未完成驗證時不能使用管理員或審核權限。

部署環境必須設定 `SUPABASE_SERVICE_ROLE_KEY`。此金鑰只可放在 Vercel Environment Variables，絕對不能加入 `NEXT_PUBLIC_` 前綴或寫入前端程式。

請在 Supabase Dashboard → Authentication → Email Templates → Magic Link 將範本改為顯示 `{{ .Token }}`，不要使用 `{{ .ConfirmationURL }}`。驗證碼長度與有效期限沿用 Authentication 的 OTP 設定。

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

目前原型不包含付款、物流、站內聊天或評價。

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

1. 先將本功能透過 `ai/codex/任務名稱` 分支建立 PR，讓 GitHub 註冊 **AI 交接完整性** 檢查。
2. 到 **Settings → Rules → Rulesets** 新增針對預設分支的規則。
3. 啟用必須使用 PR、必須通過 **AI 交接完整性**、禁止 force push 與禁止刪除分支。
4. 個人帳號不設定 bypass；若 bypass 清單可選 **GitHub Actions** GitHub App，將它設為 `Always allow`，讓正式網站救援工作流程仍能推送回復 commit。
5. Codex 使用 `ai/codex/任務名稱`，Cursor 使用 `ai/cursor/任務名稱`；目前 PR 合併後，下一個 AI 才能接手。

如果 bypass 清單沒有 GitHub Actions，先不要啟用「必須使用 PR」；否則現有一鍵回復工作流程會被擋住。需先另外為救援工作流程建立可被規則辨識的 GitHub App 或專用 deploy key，再啟用該規則。
