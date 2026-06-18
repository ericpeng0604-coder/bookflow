# AI 交接歷史

- 任務：improve mobile book OCR speed and reliability
- 執行者：codex
- 狀態：完成
- 基準 Commit：`857a96a1ed84b0414a8571ef6d88a30bfb479552`
- 封存時間：2026-06-18T05:13:27.942Z

---
# BookFlow AI Handoff

## 目前目標

改善手機版課本封面 OCR 的速度與正確性，避免低品質辨識結果覆寫刊登欄位。

- 限制 OCR 處理像素並強化封面對比。
- 選圖後預先載入英文快速辨識工作器。
- 英文快路徑無法取得可信結果時，才載入繁體中文補強。
- 對書名、作者與版本做可信度與格式檢查。
- 使用者重新選圖時，舊的非同步結果不得覆寫新表單。

## 重要背景與決策

- 使用者提供的手機截圖顯示 OCR 把 `ee7讖呈人mmY...` 類混合亂碼寫入書名。
- 舊流程每次使用 `eng+chi_tra` 對完整圖片執行一次性辨識，沒有工作器重用或像素上限。
- 真實截圖基準：舊流程約 4.2 秒，並辨識到大量頁面雜訊。
- 低解析封面快路徑配合工作器重用與稀疏文字模式約 1.5 秒。
- 本次沒有資料庫、RPC 或 migration 變更。

## 已完成

- 更新 `lib/marketplace/free-ocr.ts`：
  - 圖片長邊限制為 1400px，轉灰階並提高對比。
  - 重用英文與中英工作器，採用封面稀疏文字模式。
  - 英文優先、繁中延遲載入。
  - 同一張 File 重複點擊會共用辨識結果。
  - 新增模糊已知封面匹配與欄位可信度閘門。
- 更新 `components/marketplace-app.tsx`：
  - 選圖時背景預熱 OCR。
  - 顯示準備、英文快路徑與中文補強進度。
  - 低可信結果不再覆寫欄位。
  - 重新選圖會取消舊結果的寫入資格。
- 擴充 `scripts/check-free-ocr-book-covers.mjs`：
  - 驗證手機模糊文字可回復《普通物理學》。
  - 驗證混合亂碼不會成為書名。
- 新增 `scripts/check-mobile-book-ocr.mjs` 並納入專案檢查。
- 更新 `AI_WORK_MANUAL.md` 記錄 OCR 輸出不可信的預防規則。

## 剩餘工作

- 提交、推送與建立 PR。
- 合併後確認 production deployed commit 與正式站 bundle。

## 修改範圍

- `lib/marketplace/free-ocr.ts`
- `components/marketplace-app.tsx`
- `scripts/check-free-ocr-book-covers.mjs`
- `scripts/check-mobile-book-ocr.mjs`
- `scripts/run-project-checks.mjs`
- `package.json`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md` after completion script runs

## 驗證結果

- 手機截圖舊流程基準：4212ms，信心 74，但輸出包含頁面雜訊與錯誤書名。
- 英文工作器重用加稀疏文字模式：約 1496–1556ms，可讀到模糊的 `Essential University Physics`。
- `node --experimental-strip-types scripts/check-free-ocr-book-covers.mjs`：10/10 passed。
- `node scripts/check-mobile-book-ocr.mjs`：passed。
- `node node_modules/typescript/bin/tsc --noEmit`：passed。
- `node node_modules/eslint/bin/eslint.js .`：0 errors，1 個既有 `<img>` warning。
- `node scripts/run-project-checks.mjs`：19/19 passed。
- `node node_modules/next/dist/bin/next build`：passed，只有既有 `<img>` warning。
- 修改文字 UTF-8 與 `git diff --check`：passed。

## 風險或阻礙

- OCR 仍受反光、傾斜、封面字體與拍攝距離影響；低可信結果會保守地留給使用者手動填寫。
- 正式站尚未部署與驗證，不能把本機完成描述為已在線上實裝。

## 下一個 AI 的操作

1. 提交並推送分支。
2. 建立 PR、等待檢查並合併。
3. 驗證 `https://bookflow-green.vercel.app/api/health/release` 與正式站 bundle。

## 最後基準 Commit

分支基準：`857a96a1ed84b0414a8571ef6d88a30bfb479552`
