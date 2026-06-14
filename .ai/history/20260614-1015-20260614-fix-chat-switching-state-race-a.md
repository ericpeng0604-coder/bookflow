# AI 交接歷史

- 任務：fix chat switching state race and deploy
- 執行者：codex
- 狀態：完成
- 基準 Commit：`8109eaa60c86bc5d72edf824275f0764873a6b7d`
- 封存時間：2026-06-14T10:15:32.360Z

---
# BookFlow AI Handoff

## 目前目標

修正快速切換聊天室時，上一個聊天室的訊息、圖片或延遲回應可能出現在新聊天室的狀態競爭問題，並完成正式發布。

## 重要背景與決策

- `TradeChatPanel` 先前會在 `conversation.id` 改變時沿用元件狀態。
- 舊聊天室的訊息請求或圖片簽名如果較慢完成，可能覆蓋目前選取的聊天室。
- 以聊天室 ID 作為 React `key`，讓不同聊天室使用獨立元件狀態。
- effect cleanup 會停用舊非同步回呼並移除舊 Realtime channel。
- 本次不需要 Supabase migration。
- 未修改受保護的 rollback workflow 或 CODEOWNERS。

## 已完成

- 切換聊天室時清除上一個聊天室的訊息、圖片、游標與分頁狀態。
- 阻止已卸載聊天室的訊息、圖片與 Realtime 回呼更新畫面。
- 新增 `scripts/check-chat-switching.mjs` 及 `check:chat-state` 指令。
- 在 `AI_WORK_MANUAL.md` 新增非同步 UI 狀態的防錯規則。
- 已在本機確認首頁與登入視窗正常，瀏覽器主控台沒有錯誤。

## 剩餘工作

1. 執行完整型別、lint、建置及專案檢查。
2. 提交並推送 `codex/chat-state-race-fix`。
3. 建立 PR、等待檢查並合併至 `main`。
4. 等待 Vercel Production 完成，再驗證正式網站。

## 修改範圍

- `components/marketplace-app.tsx`
- `scripts/check-chat-switching.mjs`
- `package.json`
- `AI_WORK_MANUAL.md`
- AI 交接狀態與歷史檔

## 驗證結果

- Chat switching state checks：4/4 通過。
- Refresh guard checks：7/7 通過。
- Trade workflow checks：14/14 通過。
- Notification refresh checks：4/4 通過。
- TypeScript `tsc --noEmit` 通過。
- ESLint 0 errors；保留 3 個既有圖片效能 warnings。
- Next.js production build 通過。
- Filter、lifecycle、browser push、capacity checks 通過。
- 本機首頁載入正常，瀏覽器主控台 0 errors/warnings。

## 風險或阻礙

- 聊天室完整切換情境需要有至少兩個聊天室的登入帳號；本次以狀態生命週期檢查與正式建置覆蓋回歸風險。
- 工作區存在未追蹤的本機工具檔，不會納入提交。

## 下一個 AI 的操作

1. 確認 PR 檢查全部通過。
2. 合併 PR 後等待 Vercel Production Ready。
3. 驗證 `https://bookflow-green.vercel.app/` 可正常載入且主控台無錯誤。
4. 比對正式站資產或 commit 狀態，確認新版本已上線。

## 最後基準 Commit

`8109eaa`，即建立本分支時的 `origin/main`。
