# AI 交接歷史

- 任務：simplify desktop navigation and remove duplicate listing upload control
- 執行者：codex
- 狀態：完成
- 基準 Commit：`2c8c760c082f488a7d27266688316f828f5356c0`
- 封存時間：2026-06-18T03:07:18.223Z

---
# BookFlow AI Handoff

## 目前目標

精簡電腦版導覽與刊登圖片介面，避免同一功能在畫面上重複出現。

- 電腦版導覽只顯示目前市場適用的「找／逛」、「我要刊登」與「我的交易」。
- 課本與二手物品只能從右上角選單切換。
- 市場列表內不再顯示第二組課本／二手物品切換按鈕。
- 刊登表單只保留一個美化後的檔案選擇控制，移除大型重複上傳卡片。

## 重要背景與決策

- 目前市場模式仍決定導覽文字、刊登類型、篩選器與整體主題。
- 「我要刊登」會直接刊登目前市場類型，不再同時展示兩種刊登入口。
- 課本 OCR 功能保留；選擇圖片後仍可使用照片辨識。
- 本次只有前端介面與回歸檢查變更，沒有 schema、RPC 或 migration。
- 主工作區既有的 README、marketplace 查詢與 `.cursor/mcp.json` 修改不屬於本次提交。

## 已完成

- 更新 `components/marketplace-app.tsx`：
  - 精簡桌面與右上角選單中的導覽。
  - 移除市場列表內的重複模式切換。
  - 儀表板只顯示目前市場對應的刊登按鈕。
  - 刊登表單改為單一原生檔案控制並保留圖片預覽與 OCR。
- 更新 `app/globals.css`：
  - 移除舊市場切換與大型上傳卡片樣式。
  - 美化原生檔案按鈕、容器、hover 與 focus 狀態。
- 新增 `scripts/check-listing-navigation-ui.mjs` 並納入專案檢查。
- 更新 `AI_WORK_MANUAL.md`，記錄隱藏檔案欄位被表單樣式覆蓋的預防規則。

## 剩餘工作

- 提交、推送與建立 PR。
- 合併後確認 production deployed commit。
- 在正式站驗證精簡導覽、唯一市場切換與登入保護。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `scripts/check-listing-navigation-ui.mjs`
- `scripts/run-project-checks.mjs`
- `package.json`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md` after completion script runs

## 驗證結果

- `node scripts/check-listing-navigation-ui.mjs`：passed。
- `node node_modules/typescript/bin/tsc --noEmit`：passed。
- `node node_modules/eslint/bin/eslint.js .`：0 errors，1 個既有 `<img>` warning。
- `node scripts/run-project-checks.mjs`：18/18 passed。
- `node node_modules/next/dist/bin/next build`：passed，只有既有 `<img>` warning。
- `node scripts/ai-collaboration.mjs check`：passed。
- 本機 Browser smoke：
  - 課本模式桌面導覽只顯示「找課本 / 我要刊登 / 我的交易」。
  - 右上角選單可切換到二手物品。
  - 二手模式套用 `theme-secondhand`，導覽只顯示「逛二手物品 / 我要刊登 / 我的交易」。
  - 市場列表內沒有第二組模式切換。

## 風險或阻礙

- 未登入狀態會先進入會員驗證，因此圖片上傳控制的實際互動需在登入狀態再做最終 smoke。
- 正式站尚未部署與驗證，不能把本機完成描述為已在線上實裝。

## 下一個 AI 的操作

1. 提交、推送並建立 PR。
2. 合併後驗證 `https://bookflow-green.vercel.app/api/health/release`。
3. 在正式站確認導覽與唯一市場切換。

## 最後基準 Commit

分支基準：`2c8c760c082f488a7d27266688316f828f5356c0`
