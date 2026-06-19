# AI 交接歷史

- 任務：fix production book OCR Vercel OIDC runtime token
- 執行者：codex
- 狀態：完成
- 基準 Commit：`5b77a132e95ad48f5b34999b1b3f446665208a70`
- 封存時間：2026-06-19T00:30:30.565Z

---
# BookFlow AI Handoff

## 目前目標

修正正式站 AI 封面備援無法取得 Vercel runtime OIDC token：

- 瀏覽器先執行免費 OCR 與欄位可信度判斷。
- 本機結果不足時，自動呼叫伺服器端 `gpt-5.4-mini` 視覺模型。
- AI 只補空白欄位，不覆蓋使用者已輸入的內容。
- 每位登入使用者每天最多使用 20 次雲端補強。
- 完成 migration、staging、PR、production migration、部署與正式站驗證。

## 重要背景與決策

- 實作位於獨立且乾淨的 `codex/mobile-ocr-reliability` 工作樹，未碰主工作區的其他修改。
- 保留 Tesseract 作為免費第一層；只有低信心或欄位不足時才產生 OpenAI 成本。
- OpenAI 金鑰只存在伺服器環境，瀏覽器以 Supabase access token 呼叫受保護端點。
- Vercel Function 必須從 `x-vercel-oidc-token` request header 取得 runtime OIDC token。
- 封面圖片只用於當次請求，BookFlow 不另行儲存或記錄圖片與模型原始回覆。
- 出版社成為正式的 `books.publisher` 欄位，市集 RPC、搜尋、表單與顯示同步支援。

## 已完成

- 手機 OCR：
  - 圖片縮放、灰階對比強化、worker 預熱與快取。
  - 英文快速辨識後才載入繁體中文 fallback。
  - 亂碼與不合理欄位阻擋。
  - 欄位不足時回報 `needsAiFallback`。
- AI 備援：
  - 新增 `/api/ai/book-cover`。
  - 驗證登入、格式、5MB 上限、25 秒逾時與伺服器設定。
  - 使用 Responses API、圖片輸入及 strict JSON schema。
  - 支援 Vercel AI Gateway OpenResponses、OIDC 與 Zero Data Retention。
  - 修正 runtime OIDC token 由 request header 取得，而非只讀取 build-time 環境變數。
  - 不清楚的欄位必須回傳 null，不允許依常識猜測。
- 成本與資料庫：
  - 新增 `book_ocr_daily_usage`。
  - 新增 service-role-only `consume_book_ocr_quota` 原子額度函式。
  - 預設每位使用者每日 20 次，可由環境變數調整。
  - 新增 `books.publisher` 並更新相關 RPC。
- 前端：
  - 本機辨識不足時自動啟用 AI。
  - 等待期間若使用者已輸入，結果不覆蓋該欄位。
  - 顯示處理階段、剩餘額度、錯誤與雲端隱私說明。
- 文件與檢查：
  - 更新 `.env.example`、README、AI 工作手冊與 staging probes。
  - 新增 AI 請求、驗證、額度、隱私與 non-destructive merge 回歸檢查。

## 剩餘工作

- 執行完整 lint、project checks、production build。
- 建立修復 PR、合併並等待 Vercel production。
- 用同一張普通物理學照片驗證 AI 備援回傳正確欄位。

## 修改範圍

- `lib/marketplace/free-ocr.ts`
- `lib/marketplace/book-ocr-ai.ts`
- `lib/server/book-ocr-ai.ts`
- `app/api/ai/book-cover/route.ts`
- `components/marketplace-app.tsx`
- `supabase/migrations/20260618090000_book_ocr_ai_quota.sql`
- 型別、mapper、schema、環境範例、README、樣式與驗證腳本
- `AI_WORK_MANUAL.md`
- AI handoff/state/history files

## 驗證結果

- 正式照片測試：本機 OCR 阻擋了原始亂碼，但雲端 fallback 回傳服務設定缺失，已定位為 OIDC header 讀取錯誤。
- `tsc --noEmit`：passed。
- `check-book-ocr-ai.mjs`：passed，包含 runtime OIDC header assertion。
- `run-project-checks.mjs`：20/20 passed。
- ESLint：0 errors，1 個既有 `<img>` warning。
- Production build：passed。
- `git diff --check`：passed。

## 風險或阻礙

- 此修復沒有 schema 變更，不需新的 production migration。
- 真實辨識仍必須在重新部署後以登入狀態驗證。

## 下一個 AI 的操作

1. 執行完整本機驗證。
2. 合併修復 PR 並等待 production smoke。
3. 用實際普通物理學照片重跑辨識，不送出刊登。

## 最後基準 Commit

`5b77a132e95ad48f5b34999b1b3f446665208a70`
