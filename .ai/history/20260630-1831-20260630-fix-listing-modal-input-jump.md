# AI 交接歷史

- 任務：fix listing modal input jump
- 執行者：codex
- 狀態：完成
- 基準 Commit：`f293bae848f14a4b6fd026e2b4a10e071383cb5d`
- 封存時間：2026-06-30T18:31:41.657Z

---
# BookFlow AI Handoff

## 目前目標

- 修正刊登表單在 modal 中輸入任何文字或數字時，畫面跳回上方、焦點離開正在輸入欄位的問題。
- 本次修的是 modal focus trap 反覆重跑，不是上一輪已修過的 Enter 隱式送出。

## 重要背景與決策

- Branch: `codex/fix-listing-modal-input-jump`.
- Base: `f293bae848f14a4b6fd026e2b4a10e071383cb5d`.
- 根因在 `ModalShell`：focus-trap effect 依賴 inline `onClose` callback，刊登表單的 controlled input 每次輸入都會 render，導致 effect cleanup/setup 重新執行初始 focus。
- 修法是把最新 `onClose` 存進 ref，讓 Escape handler 取得最新 close callback，同時讓 focus-trap effect 只在 modal mount 時建立。
- 沒有資料庫 migration。
- 沒有修改受保護 rollback/recovery 檔案。

## 已完成

- 更新 `components/marketplace-app.tsx`，避免 `ModalShell` 在每次輸入 render 後重跑初始 focus。
- 更新 `scripts/check-listing-navigation-ui.mjs`，加入 modal focus trap 不得依賴 unstable callback 的回歸檢查。
- 新增 `AI_WORK_MANUAL.md` lesson，記錄此類 modal focus trap 問題的偵測與預防規則。
- 已接手 `.ai/state.json` 任務狀態。
- 已跑完 focused checks、project checks、TypeScript、ESLint 與 production build。

## 剩餘工作

- Commit、push、開 PR、等 checks、合併。
- 等正式站部署到合併 commit 後跑 production release smoke。

## 修改範圍

- `components/marketplace-app.tsx`
- `scripts/check-listing-navigation-ui.mjs`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md` after completion

## 驗證結果

- `node scripts/check-listing-navigation-ui.mjs`: passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 23/23 checks.
- `node node_modules/next/dist/bin/next build`: passed.
- Protected rollback/recovery files diff check: no changes.

## 風險或阻礙

- 風險低：修正範圍只在 modal focus lifecycle，不改表單資料、送出 API、資料庫或上傳流程。
- 若正式站仍有跳動，需要在使用者已登入頁面用事件監聽確認是否還有外層 scroll 或 validation 來源。

## 下一個 AI 的操作

1. Run focused and project checks.
2. Complete AI collaboration state.
3. Commit and push `codex/fix-listing-modal-input-jump`.
4. Open and merge PR after required checks pass.
5. Verify production commit and run release smoke.

## 最後基準 Commit

`f293bae848f14a4b6fd026e2b4a10e071383cb5d`
