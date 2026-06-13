# BookFlow AI 交接

## 目前目標

發布多人洽談、安全聊聊與訂單流程，並修正正式 Supabase 遷移對舊版
`purchase_requests` RLS 規則的相容性。

## 重要背景與決策

正式站採 Supabase 管理交易資料、Vercel 發布前端；Email 通知維持停用，
訂單小時級排程由 Supabase Cron 負責。

## 已完成

- PR #9 已合併至 `main`，合併提交為 `37947e9`。
- Vercel 已完成原功能版本的建置。
- 正式 Supabase 第一次執行遷移時，在變更 `status` 欄位型別前安全失敗。
- 已確認失敗原因是舊版 `Active buyers can cancel pending requests` 規則仍依賴
  `status` 欄位。
- 遷移現在會在型別變更前移除該舊規則，並在新授權模型階段再次清理。
- 遷移也會在型別變更前移除舊版訂單通知 Trigger，之後依新版流程重建。
- 交易工作流程檢查通過 11/11，差異檢查通過。
- 已在 `AI_WORK_MANUAL.md` 記錄欄位型別遷移的 RLS 相依檢查規則。

## 剩餘工作

1. 合併 PR #10。
2. 在正式 Supabase 重新執行
   `supabase/multi-party-orders-and-safe-chat.sql`。
3. 驗證 `conversations`、`favorites`、`order_events`、`chat_reports`、
   `process_trade_deadlines` 與每小時 Cron。
4. 等待 Vercel 正式部署 Ready。
5. 在正式網站做唯讀驗收，確認首頁、書籍頁與新訂單介面沒有載入錯誤。

## 修改範圍

- `supabase/multi-party-orders-and-safe-chat.sql`
- `AI_WORK_MANUAL.md`
- `components/marketplace-app.tsx`
- `lib/marketplace/`
- `scripts/check-trade-workflow.mjs`

## 驗證結果

- 交易工作流程檢查通過 11/11。
- `git diff --check` 通過。
- PR #10 的 Vercel 預覽建置通過。

## 風險或阻礙

- Email 通知維持停用。
- 不要手動呼叫 `process_trade_deadlines` 驗證，以免提前處理真實訂單。
- Supabase 遷移成功前，不可宣稱新功能已完整上線。

## 下一個 AI 的操作

1. 等待並合併 PR #10。
2. 重新執行正式 Supabase 遷移，若再出現相依錯誤，先修正再重跑。
3. 用唯讀查詢驗證資料表、函式與 Cron，再確認正式 Vercel 部署。

## 最後基準 Commit

`9362233`
