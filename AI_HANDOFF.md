# BookFlow AI 交接

## 目前目標

Codex 與 Cursor 共用同一份 GitHub 交接資料，切換 AI 時能延續工作而不遺漏決策與驗證結果。

## 重要背景與決策

- 一次只由一個 AI 工作。
- 切換前先完成交接、通過 PR 檢查並合併至 `main`。
- `.ai/state.json` 是狀態來源，本檔案是給人與 AI 閱讀的繁體中文摘要。
- 不記錄完整對話、密碼、驗證碼、Token、私鑰或個人敏感資料。
- 正式網站一鍵回復系統及其保護檔案不可因一般工作而修改。

## 已完成

- 建立 Codex 與 Cursor 共用交接格式及操作指令。
- 建立 Codex 啟動／結束檢查 Hook。
- 建立 Cursor 自動讀取規則。
- 建立 GitHub PR 強制交接完整性檢查。

## 剩餘工作

- 在 GitHub 將 `AI 交接完整性` 設為 `main` 的必要檢查。
- 第一次在 Codex 開啟專案時，透過 `/hooks` 信任專案 Hook。

## 修改範圍

- `.ai/`、`.codex/`、`.cursor/`
- `AI_HANDOFF.md`
- `scripts/ai-collaboration.mjs`
- `.github/workflows/check-ai-handoff.yml`
- `package.json`、`README.md`

## 驗證結果

- `ai:status`、`ai:check` 與 Codex Hook 檢查通過。
- Codex 接手後，Cursor 重複接手會被拒絕；完成後可正常封存並解除占用。
- CI 模擬確認程式修改缺少交接資料時失敗，補齊狀態、摘要與歷史後通過。
- TypeScript `--noEmit` 與 Next.js production build 均通過。

## 風險或阻礙

- GitHub 規則設定屬於 repository 外部設定，必須在 GitHub 網站完成一次。
- 2026-06-11 嘗試透過 Chrome 設定時，GitHub 規則頁連線逾時，尚未變更外部權限。
- 若 Codex 尚未信任專案 Hook，交接檔仍可手動讀取，但不會自動顯示。

## 下一個 AI 的操作

1. 先執行 `npm run ai:status`。
2. 確認沒有其他 AI 處於 `in_progress` 或 `blocked`。
3. 執行 `npm run ai:claim -- codex "任務名稱"` 或 `npm run ai:claim -- cursor "任務名稱"`。
4. 工作完成後更新本檔案，再執行交接或完成指令。

## 最後基準 Commit

`6c76736b47f1fdfc8368ca179957e3764fa16a37`
