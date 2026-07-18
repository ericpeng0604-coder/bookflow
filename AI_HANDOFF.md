# BookFlow AI Handoff

## 任務目標

發布聊天室相關修改，統一新版訊息入口，新增已確認訂單分頁，並以可辨識的版本標記驗證測試與正式部署 provenance。

## 目前狀態與背景

- Task ID: `20260718-deploy-unified-chat-confirmed-orders`.
- Task: `deploy unified chat and confirmed orders`.
- Branch: `codex/chat-unified-confirmed-orders-release`.
- Base commit: `99706bddf27a54e97dda5e8fedfb0eef6166acdc`.
- History: `.ai/history/20260718-deploy-unified-chat-confirmed-orders.md`.
- Database migration included: none.
- Supabase RLS and database schema are unchanged.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 實作範圍

- 所有訊息入口統一導向 `view=chat&tab=chats`，並正規化舊的 dashboard chat URL。
- 直接開啟 conversation URL 時，以 URL 狀態優先，避免舊 dashboard shell 或 legacy chat markup 顯示。
- 新增 `confirmedOrders` tab，將 `reserved`、`awaiting_confirmation`、`completed` 從原意願列表分類到已確認訂單。
- 保留既有交易、聯絡、確認面交、完成交易、評價與新版訊息操作。
- 顯示 `APP_VERSION` 版本 badge，支援 `NEXT_PUBLIC_APP_VERSION` 覆寫。
- 保留既有 mobile 列表／聊天室切換與 responsive chat layout。

## 驗證狀態

- Project checks: passed, 33/33.
- Chat switching checks: passed, 5/5.
- Confirmed orders checks: passed, 12/12.
- Site version checks: passed, 4/4.
- TypeScript typecheck: passed.
- ESLint for changed source: passed; CSS is ignored by the repository ESLint configuration.
- `git diff --check`: passed.
- Production build: CI verification required; local build not run while the active Next dev server owns the shared `.next` output.
- Production browser smoke: pending PR merge and deployment.

## 發布要求

1. 使用本 branch 建立 PR，等待 CI 與 Vercel checks。
2. 合併後確認正式站部署 commit 與合併版本一致。
3. 以正式站 release health、首頁與聊天室 smoke test 完成證據鏈。

## 目前 implementation commit

- Feature commit: `bd07178537a1c6cd74478b6a712776614b84023b`.

## 交接規則

- 只發布本次聊天室與已確認訂單範圍，勿帶入原工作區其他未提交修改。
- 不保存 token、API key、密碼或使用者敏感資料。
- 若部署 commit 不一致或 smoke test 未通過，不得宣稱正式部署完成。
