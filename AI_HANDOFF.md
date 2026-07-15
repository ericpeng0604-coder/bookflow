# BookFlow AI Handoff

## 任務目標

處理 React Doctor 中最高優先且可確認的問題：避免 BookForm 在 SSR render 期間讀取 localStorage，並讓 Modal 與圖片 lightbox 使用原生 dialog 的焦點及鍵盤管理。

## 目前狀態與背景

- Branch: `codex/react-doctor-priority-fixes`.
- Base commit: `db75c82f243bf704c30e80d1238cefbd6e74927a`.
- No database migration, GitHub workflow, deployment configuration, or protected recovery file is changed.
- The original dirty checkout remains untouched.

## 已完成

- BookForm 使用穩定的 server/client 初始草稿，掛載後才載入科系偏好與 localStorage 草稿。
- ModalShell、學生證圖片及聊天圖片統一使用原生 dialog，保留 Escape、背景關閉設定與焦點復原。
- 更新刊登 UI 回歸檢查，驗證 render 階段不讀 browser storage 且三種對話框使用原生 dialog。
- React Doctor browser-global errors 從 2 降為 0，prefer-html-dialog warnings 從 3 降為 0，分數從 32 提升至 39。

## 下一步

1. 建立 PR 並等待 GitHub checks。
2. Checks 通過後合併並確認 production smoke。

## 變更檔案

- `components/marketplace-app.tsx`
- `app/globals.css`
- `scripts/check-listing-navigation-ui.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-react-doctor-priority-fixes.md`

## 驗證結果

- TypeScript typecheck: passed.
- ESLint on changed source/check files: passed.
- Project checks: passed (27/27).
- Listing navigation and upload UI check: passed.
- Next.js production build: passed.
- Browser verification: homepage loaded, native dialog opened, Escape closed it, no page errors or Next.js overlay.
- React Doctor targeted rescan: browser-global 0, prefer-html-dialog 0, score 39.

## 風險與注意事項

- React Doctor 仍列出 14 個 errors；13 個是把 requireLogin/requireActive callback 誤判為 state updater，另 1 個 subscription cleanup 已有 removeChannel，未為了分數修改。
- 大元件拆分與次要效能 warnings 不在本批範圍。

## 下一位 AI 工作指引

1. 不要把 React Doctor 的剩餘誤報機械式改寫成大型重構。
2. 保持 `AI_HANDOFF.md`、`.ai/state.json` 與 `.ai/history/*.md` 同步。

## 相關 Commit

- Base commit: `db75c82f243bf704c30e80d1238cefbd6e74927a`.
- Current implementation commit before final commit: not committed yet.
