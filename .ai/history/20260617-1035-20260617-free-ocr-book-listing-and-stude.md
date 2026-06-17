# AI 交接歷史

- 任務：free OCR book listing and student verification
- 執行者：codex
- 狀態：完成
- 基準 Commit：`0cc305b9deece291a5a65db4ee198d390f3640de`
- 封存時間：2026-06-17T10:35:22.151Z

---
# BookFlow AI Handoff

## 目前目標

本次任務完成免費 OCR 輔助上書、學生證人工審核輔助、購買請求 7 天失效規則，以及二手市場入口調整。

- 上架書籍表單新增「使用照片填寫課本資料」，使用者拍封面後可先用 OCR 建議填入書名、作者、版本與描述。
- OCR 只產生草稿，不做價格建議，使用者仍可手動修改所有欄位。
- 學生證上傳新增 OCR 與規則標籤，管理員必須手動通過或拒絕。
- pending 購買請求逾期從 72 小時改為 7 天，逾期只更新請求狀態為 expired，不更新或移除書籍。
- 二手市場切換入口移入右上角三條線選單。

## 重要背景與決策

- 免費 AI MVP 使用瀏覽器端 Tesseract OCR，不接付費 GPT 或付費模型。
- 書籍封面辨識加入常見教材規則提示，涵蓋普通物理學、Live Escalate Trekking、基本電學、電工實習、機械製造概論、國文新視野、AutoCAD 2020、電路學等封面樣本。
- 學生證圖片規劃在 private storage bucket `student-verifications`，資料列由 RLS 與 admin RPC 管理。
- 這次有資料庫 migration，production 上線時必須跑 production migration 後再做 smoke。
- 本機未追蹤檔 `.cursor/mcp.json`、`_run_verify.cmd`、`_verify_report.txt`、`output/` 是既有本機檔，未納入本次提交。

## 已完成

- 新增 migration `supabase/migrations/20260617090000_purchase_expiry_and_student_verifications.sql`：
  - 建立 private student ID bucket。
  - 建立 `student_verifications` 表與 RLS。
  - 新增 `submit_student_verification`、`list_student_verifications_for_review`、`review_student_verification` RPC。
  - 覆寫 `process_trade_deadlines`，pending expiry 改為 7 天，且不更新 `books`。
- 更新 legacy SQL `supabase/multi-party-orders-and-safe-chat.sql` 的 pending expiry 規則。
- 新增 `lib/marketplace/free-ocr.ts`，集中 OCR 載入、書籍欄位萃取、學生證品質標籤。
- 更新 `components/marketplace-app.tsx`：
  - listing modal 頂部新增使用照片 OCR 區塊。
  - 表單欄位改為可被 OCR 草稿填入且仍可手動編輯。
  - profile modal 新增學生證上傳區。
  - admin 後台新增學生證審核卡片與通過/拒絕操作。
  - hamburger menu 加入二手市場/課本市場切換，桌面主導覽弱化二手入口。
- 更新 `app/globals.css`，加入照片輔助、學生證上傳、審核卡片樣式。
- 新增 `scripts/check-free-ocr-book-covers.mjs` 並掛進 project checks。
- 新增 `tesseract.js` dependency。

## 剩餘工作

- 建立 PR 到 `main`。
- 等待 GitHub checks、Vercel preview、staging migration。
- 合併後執行 production migration。
- 驗證 production `/api/health/release` deployed commit。
- production smoke：
  - 書籍上架 modal 可看到「使用照片填寫課本資料」。
  - hamburger menu 可切換課本/二手市場。
  - pending request 7 天才 expired，且 book row 不被下架或刪除。
  - 學生證審核 bucket 不公開，admin 可人工審核。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `lib/marketplace/free-ocr.ts`
- `scripts/check-free-ocr-book-covers.mjs`
- `scripts/check-trade-workflow.mjs`
- `scripts/run-project-checks.mjs`
- `supabase/migrations/20260617090000_purchase_expiry_and_student_verifications.sql`
- `supabase/multi-party-orders-and-safe-chat.sql`
- `package.json`
- `package-lock.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md` after completion script runs

## 驗證結果

已通過本機驗證：

- `node scripts/check-trade-workflow.mjs`：15/15 passed。
- `node node_modules/typescript/bin/tsc --noEmit`：passed。
- `node scripts/run-project-checks.mjs`：17/17 passed。
- `node node_modules/eslint/bin/eslint.js .`：0 errors，1 warning，warning 是既有 `<img>` 使用。
- `node node_modules/next/dist/bin/next build`：passed，同樣只有 `<img>` warning。
- 實際封面 OCR 測試：Electric Circuits / 電路學封面可解析為 title `電路學`、author `James W. Nilsson、Susan A. Riedel`、edition `11th Edition`，並保留 publisher hint。
- Browser smoke：首頁可載入，hamburger menu 有「逛二手市場」，點擊後切換到 secondhand theme 並關閉選單。

## 風險或阻礙

- OCR 準確度受照片角度、反光、字體與封面版面影響；目前設計為建議草稿，不可當作自動審核或自動上架。
- 學生證 OCR 只提供品質/校名提示，不自動通過、不自動拒絕、不自動停權。
- Tesseract 從 CDN 載入，若使用者網路或瀏覽器阻擋 CDN，表單仍能手動填寫。
- Production migration 必須確認 storage bucket policy 與 RPC 權限。
- 不包含價格建議功能。

## 下一個 AI 的操作

1. 建立並合併 PR。
2. 跑 staging/prod migration。
3. 完成 production smoke 後回報 production commit 與驗證結果。
4. 若之後要讓只拍封面更準，可再加公開書籍資料庫查詢，但要處理外部 API rate limit、資料錯誤、隱私與 fallback。

## 最後基準 Commit

目前功能 commit：`0cc305b9deece291a5a65db4ee198d390f3640de`
