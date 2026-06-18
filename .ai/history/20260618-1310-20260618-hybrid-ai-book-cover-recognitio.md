# AI 交接歷史

- 任務：hybrid AI book cover recognition and production deployment
- 執行者：codex
- 狀態：完成
- 基準 Commit：`7eef7fe1a3d874ad40a294f25e4844f11d825ec8`
- 封存時間：2026-06-18T13:10:26.595Z

---
# BookFlow AI Handoff

## 目前目標

將課本封面辨識改為低成本混合流程並完整部署：

- 瀏覽器先執行免費 OCR 與欄位可信度判斷。
- 本機結果不足時，自動呼叫伺服器端 `gpt-5.4-mini` 視覺模型。
- AI 只補空白欄位，不覆蓋使用者已輸入的內容。
- 每位登入使用者每天最多使用 20 次雲端補強。
- 完成 migration、staging、PR、production migration、部署與正式站驗證。

## 重要背景與決策

- 實作位於獨立且乾淨的 `codex/mobile-ocr-reliability` 工作樹，未碰主工作區的其他修改。
- 保留 Tesseract 作為免費第一層；只有低信心或欄位不足時才產生 OpenAI 成本。
- OpenAI 金鑰只存在伺服器環境，瀏覽器以 Supabase access token 呼叫受保護端點。
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

- 執行完整 lint、project checks、production build 與瀏覽器測試。
- 提交並推送分支，建立 PR。
- 等待 Release Readiness、Staging Migration 與 Vercel Preview。
- 合併後執行 production migration。
- 確認 Vercel production 已設定 `OPENAI_API_KEY`、模型與每日額度。
- 驗證正式站 release commit、實際失敗照片與手機流程。

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

- `tsc --noEmit`：passed。
- `check-free-ocr-book-covers.mjs`：10/10 passed。
- `check-mobile-book-ocr.mjs`：passed。
- `check-book-ocr-ai.mjs`：passed。
- `git diff --check`：passed。

## 風險或阻礙

- 正式環境必須已有有效 `OPENAI_API_KEY`；沒有金鑰時端點會安全回傳 503。
- Migration 必須先通過 staging 再套用 production，否則 AI 端點會因 quota RPC 不存在而回傳 503。
- 真實模型辨識必須使用已登入帳號與正式或 preview 環境測試，不能由靜態測試取代。

## 下一個 AI 的操作

1. 執行完整本機驗證與瀏覽器流程。
2. 完成 PR 與 staging migration。
3. 合併並執行 production migration。
4. 設定／確認 Vercel OpenAI 環境變數並等待正式部署。
5. 用實際普通物理學失敗照片驗證欄位與 non-destructive merge。

## 最後基準 Commit

`7eef7fe1a3d874ad40a294f25e4844f11d825ec8`
