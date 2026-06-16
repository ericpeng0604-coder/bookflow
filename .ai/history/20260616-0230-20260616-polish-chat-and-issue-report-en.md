# AI 交接歷史

- 任務：polish chat and issue report entry points
- 執行者：codex
- 狀態：完成
- 基準 Commit：`de8dfdc1f06113e96c265e70db00d17a824a1c45`
- 封存時間：2026-06-16T02:30:22.892Z

---
# BookFlow AI Handoff

## 目前目標

準備發布「手機聊聊收合」與「問題回報入口調整」：

- 手機版聊聊開啟對話後，保留左側聊天欄窄軌，使用者點一下左側聊天欄即可收起對話框回到列表。
- 前台問題回報入口只保留在頁尾右下角，呈現為可點擊文字，不再出現在桌機導覽列、手機選單或全站浮動按鈕。
- 問題回報表單與後台管理文案維持「問題回報」語意。

## 重要背景與決策

- 這次是前端互動與文案/版面調整，不需要資料庫 migration。
- 保留既有 `submit_feedback`、`resolve_feedback`、`list_feedback_for_moderation` RPC 名稱，避免不必要的資料庫相容性風險。
- `AI_WORK_MANUAL.md` 的 recovery 保護規則已套用；未修改下列受保護檔案：
  - `.github/workflows/rollback-production.yml`
  - `.github/workflows/protect-rollback-workflow.yml`
  - `.github/CODEOWNERS`
- `.cursor/mcp.json`、`_run_verify.cmd`、`_verify_report.txt`、`output/` 是既有未追蹤本機輔助檔，未納入提交。

## 已完成

- 新增手機版聊聊收合互動：
  - 對話開啟時，手機版聊天列表不再完全隱藏，改為 42px 左側窄軌。
  - 點擊左側窄軌時，如果 viewport 小於等於 640px，會清空 `expandedConversationId` 並收起對話框。
  - 原本的「返回聊聊」按鈕仍保留。
- 調整問題回報入口：
  - 移除桌機上方導覽列的「問題回報」。
  - 移除手機選單中的「問題回報」。
  - 移除全站右下浮動「問題回報」按鈕。
  - 頁尾保留「問題回報」作為文字連結，定位在頁尾右下角，不影響「讓每一本課本，都找到下一位需要它的人。」標語排列。
- 更新 `scripts/check-chat-visibility-and-feedback.mjs`，新增手機聊天窄軌收合檢查，並將 feedback 檢查描述更新為 issue report 語意。
- 已建立 GitHub PR：
  - https://github.com/ericpeng0604-coder/bookflow/pull/27

## 剩餘工作

- 將本次 AI handoff 修正提交並推送到 PR #27。
- 等 GitHub checks 全部通過。
- 合併 PR #27 到 `main`。
- 等 Vercel production 部署完成。
- 使用 production `/api/health/release` 或等效線上檢查確認部署 SHA。
- 線上驗證：
  - 桌機導覽列沒有「問題回報」。
  - 手機選單沒有「問題回報」。
  - 全站沒有浮動「問題回報」按鈕。
  - 頁尾右下角有文字連結「問題回報」。
  - 手機聊聊開啟對話後，點左側聊天窄軌可收起對話框。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `scripts/check-chat-visibility-and-feedback.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md`

## 驗證結果

本機已通過：

- TypeScript：`node node_modules/typescript/bin/tsc --noEmit`
- Lint：`node node_modules/eslint/bin/eslint.js .`
  - 通過，仍有既有 `<img>` warning，無 error。
- Project checks：`node scripts/run-project-checks.mjs`
  - 16/16 通過。
- Chat visibility and feedback checks：`node scripts/check-chat-visibility-and-feedback.mjs`
  - 9/9 通過。
- Production build：`node node_modules/next/dist/bin/next build`
  - 通過，仍有既有 `<img>` warning，無 error。
- 本機瀏覽器頁尾確認：
  - 導覽列沒有「問題回報」。
  - 沒有 `.floating-report`。
  - 頁尾右下角有「問題回報」文字連結。
  - 標語仍維持在原本頁尾排版中。

## 風險或阻礙

- 本機沒有可登入的真實聊天室資料，因此手機聊聊窄軌的資料情境主要由靜態檢查與 CSS/React 狀態邏輯覆蓋；線上部署後仍需用真實帳號做一次互動確認。
- Vercel production 與 GitHub merge 需要遠端 checks 完成後才能確認。
- 本次沒有 production database migration。

## 下一個 AI 的操作

1. 確認 AI handoff commit 已推送到 PR #27。
2. 監看 GitHub checks，若全部通過則合併 PR #27。
3. 等 production deployment 完成。
4. 檢查 production `/api/health/release` 的 deployed SHA 是否對應合併 commit。
5. 開啟 production 網站確認頁尾問題回報入口與手機聊聊收合互動。

## 最後基準 Commit

`de8dfdc1f06113e96c265e70db00d17a824a1c45`
