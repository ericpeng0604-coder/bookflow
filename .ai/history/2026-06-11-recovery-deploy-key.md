# AI 交接歷史

- 任務：讓救援工作流程使用專用 Deploy Key
- 執行者：Codex
- 狀態：進行中
- 基準 Commit：`5777ce70ab63a9e152ee62820c47f0dd952ace73`
- 時間：2026-06-11（Asia/Taipei）

## 目標

啟用 `main` 強制 PR 與 AI 交接必要檢查，同時確保一鍵回復及保護監控仍能緊急推送。

## 已完成

- 產生只供 BookFlow 使用的 ED25519 Deploy Key。
- 將兩個救援工作流程的 GitHub Token 權限改為唯讀。
- 讓 checkout 使用 `BOOKFLOW_RECOVERY_DEPLOY_KEY` 進行後續 Git 推送。

## 待完成

- 將公鑰加入 GitHub Deploy Keys 並允許寫入。
- 將私鑰加入 Actions Secret。
- 合併授權變更並建立 repository ruleset。

## 安全限制

- 私鑰不得寫入 repository、交接檔、日誌或回覆。
- Ruleset 僅允許 Deploy keys bypass。
- 授權提交及合併 commit 必須包含 `Rollback-Workflow-Approved: true`。
