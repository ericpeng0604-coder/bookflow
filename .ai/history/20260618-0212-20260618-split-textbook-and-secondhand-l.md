# AI 交接歷史

- 任務：split textbook and secondhand listing entries with OCR volume recognition
- 執行者：codex
- 狀態：完成
- 基準 Commit：`6f30ef065b6955cfe4993a081b054c856a9a5b11`
- 封存時間：2026-06-18T02:12:24.157Z

---
# BookFlow AI Handoff

## 目前目標

本次任務將課本市場與二手市場的刊登入口明確分開，改善課本圖片上傳介面，並修正課本 OCR 的冊別與備註行為。

- 導覽提供「課本市場 / 二手市場」與「刊登課本 / 刊登二手」獨立入口。
- 刊登表單依入口固定類型，不再在表單內切換課本與二手物品。
- 課本封面上傳區改為完整的圖片選擇介面。
- OCR 只建議書名、作者與版本，不自動填入書況說明或備註。
- OCR 在封面確實出現時辨識上冊、下冊、第一冊、第二冊或英文 Volume / Vol. 1、2。

## 重要背景與決策

- 課本與二手物品仍共用會員、個人設定、交易中心與既有 `books` 資料模型。
- 刊登入口在視覺與流程上分開，但這次不新增資料表、欄位、RPC 或 migration。
- 冊別只從 OCR 實際文字擷取，不依書名或出版社猜測。
- OCR 的出版資訊不再寫入使用者的書況說明；書況與備註必須由刊登者自行填寫。
- 本機既有 `README.md` 修改與 `.cursor/mcp.json` 不屬於這次功能提交。

## 已完成

- 更新 `components/marketplace-app.tsx`：
  - 桌面與手機導覽加入獨立市場與刊登入口。
  - 新增固定刊登類型的開啟流程。
  - 移除刊登表單內的課本/二手切換。
  - 將圖片選擇區移到表單頂部並改善文字與預覽流程。
  - OCR 不再修改書況說明或備註。
- 更新 `app/globals.css`：
  - 調整導覽間距。
  - 新增圖片上傳區的圖示、文字層級、hover 與 focus 樣式。
- 更新 `lib/marketplace/free-ocr.ts`：
  - 新增中文與英文冊別擷取。
  - 將冊別與已知版本安全合併。
  - 移除 OCR description 草稿。
- 更新 `scripts/check-free-ocr-book-covers.mjs`：
  - 驗證普通物理學上冊與下冊。
  - 驗證 OCR 不再產生 AutoCAD 備註。

## 剩餘工作

- 提交並推送功能分支。
- 建立 PR 到 `main` 並等待必要檢查與 Vercel preview。
- 合併後確認 production deployed commit。
- 在正式站驗證課本/二手入口、二手主題與登入保護。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `lib/marketplace/free-ocr.ts`
- `scripts/check-free-ocr-book-covers.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md` after completion script runs

## 驗證結果

- `node node_modules/typescript/bin/tsc --noEmit`：passed。
- `node node_modules/eslint/bin/eslint.js .`：0 errors，1 個既有 `<img>` warning。
- `node scripts/check-free-ocr-book-covers.mjs`：8/8 passed。
- `node scripts/run-project-checks.mjs`：17/17 passed。
- `node node_modules/next/dist/bin/next build`：passed，只有既有 `<img>` warning。
- 本機 Browser smoke：
  - 顯示「課本市場 / 二手市場 / 刊登課本 / 刊登二手」。
  - 二手市場套用 `theme-secondhand` 並顯示正確標題。
  - 未登入點擊刊登課本仍會進入會員登入保護。

## 風險或阻礙

- OCR 準確度仍受照片角度、反光、字體與封面版面影響，結果只作為可編輯草稿。
- 有些出版社不使用上冊/下冊；沒有辨識到冊別時系統不會猜測。
- 這次沒有 schema 或 RPC 變更，因此不需要新的 production migration。
- 正式站尚未部署與驗證，不能把本機完成描述為已在線上實裝。

## 下一個 AI 的操作

1. 確認 PR checks 與 preview。
2. 合併到 `main`。
3. 驗證 `https://bookflow-green.vercel.app/api/health/release` 的 deployed commit。
4. 在正式站重做市場切換、刊登入口與登入保護 smoke。

## 最後基準 Commit

分支基準：`6f30ef065b6955cfe4993a081b054c856a9a5b11`
