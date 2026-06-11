# BookFlow AI 交接

## 目前目標

保護 `main` 必須經過 PR 與 AI 交接檢查，同時保留正式網站一鍵回復與自動保護流程的緊急推送能力。

## 重要背景與決策

- 一次只由一個 AI 工作。
- 切換前先完成交接、通過 PR 檢查並合併至 `main`。
- `.ai/state.json` 是狀態來源，本檔案是給人與 AI 閱讀的繁體中文摘要。
- 不記錄完整對話、密碼、驗證碼、Token、私鑰或個人敏感資料。
- 正式網站一鍵回復系統及其保護檔案不可因一般工作而修改。
- 本次修改已取得使用者明確授權，救援流程改用 repository 專用 Deploy Key 推送。

## 已完成

- 建立 Codex 與 Cursor 共用交接格式及操作指令。
- 建立 Codex 啟動／結束檢查 Hook。
- 建立 Cursor 自動讀取規則。
- 建立 GitHub PR 強制交接完整性檢查。
- 建立 BookFlow 專用 Deploy Key，並將 GitHub Actions 內建 Token 權限降為唯讀。
- 讓一鍵回復與救援保護 checkout 使用 `BOOKFLOW_RECOVERY_DEPLOY_KEY`。

## 剩餘工作

- 將私鑰存入 GitHub Actions Secret、公鑰加入可寫入 Deploy Key。
- 建立安全維護 PR 並以授權 trailer 合併。
- 在 GitHub 將 `AI 交接完整性` 設為 `main` 的必要檢查，Deploy keys 為唯一 bypass。
- 第一次在 Codex 開啟專案時，透過 `/hooks` 信任專案 Hook。

## 修改範圍

- `.ai/`、`.codex/`、`.cursor/`
- `AI_HANDOFF.md`
- `scripts/ai-collaboration.mjs`
- `.github/workflows/check-ai-handoff.yml`
- `.github/workflows/rollback-production.yml`
- `.github/workflows/protect-rollback-workflow.yml`
- `package.json`、`README.md`

## 驗證結果

- `ai:status`、`ai:check` 與 Codex Hook 檢查通過。
- Codex 接手後，Cursor 重複接手會被拒絕；完成後可正常封存並解除占用。
- CI 模擬確認程式修改缺少交接資料時失敗，補齊狀態、摘要與歷史後通過。
- TypeScript `--noEmit` 與 Next.js production build 均通過。
- Deploy Key 指紋：`SHA256:/oTpci98dJVDsi+1/1SDETk3bFcsxFs9P87UJbnBoXo`。

## 風險或阻礙

- 在 Deploy Key、Actions Secret 與新工作流程版本都完成前，不可啟用強制 PR 規則。
- 若 Codex 尚未信任專案 Hook，交接檔仍可手動讀取，但不會自動顯示。

## 下一個 AI 的操作

1. 完成 GitHub Deploy Key 與 Actions Secret 設定。
2. 合併安全維護 PR，確認保護 workflow 沒有回復授權變更。
3. 建立 `main` ruleset：要求 PR、`AI 交接完整性`、禁止刪除及 force push。
4. 只允許 Deploy keys 永久繞過規則。

## 最後基準 Commit

`6c76736b47f1fdfc8368ca179957e3764fa16a37`
