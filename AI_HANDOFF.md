# BookFlow AI Handoff

## 目前目標

將 marketplace UI 修補部署到 production：OCR 辨識進度更明確、搜尋列表不抖動、未指定欄位不顯示、失效交易不顯示徽章數字，並避免待審或非 active 刊登誤顯示為販售中。

## 重要背景與決策

- 原工作區 `C:\Users\ericp\Documents\Codex\2026-06-09\codex-2` 有多個既有未提交修改，且目前在舊分支上。
- 為了避免混入無關修改，本次 release 在乾淨 worktree `C:\Users\ericp\Documents\Codex\2026-06-09\codex-2-ui-deploy` 進行。
- 乾淨分支從 current `origin/main` 建立，分支為 `codex/marketplace-ui-status-polish`。
- 最新 main 已有 OCR 進度狀態與 `<progress>` UI，本次補強樣式，不重複改 OCR 底層流程。
- 本次沒有資料庫 migration，也沒有修改 rollback 或 recovery 保護檔。

## 已完成

- 新增 marketplace 搜尋更新時的穩定列表高度與更新提示。
- 補強 OCR 進度條樣式，讓辨識中狀態更清楚。
- 隱藏空值或 `不指定` 類型的課本欄位，避免販售頁顯示未指定老師、科系、課程或主科。
- `我送出的意願` 與 `收到的意願` 徽章數字不再包含 `expired` 交易。
- `我的刊登` 與詳情頁只有 active 且 approved 的刊登才顯示 `販售中` 狀態。
- 建立本次 `.ai/state.json` 與 history entry。

## 剩餘工作

- Commit and push `codex/marketplace-ui-status-polish`。
- Open PR into `main` and wait for required checks。
- Merge after checks pass。
- Verify production deployment commit and run release smoke。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260701-1143-20260701-marketplace-ui-status-polish.md`

## 驗證結果

- `node scripts/run-project-checks.mjs`: passed, 23/23 checks.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/next/dist/bin/next build`: passed; production pages generated successfully.
- `git diff --check`: passed.
- Encoding check for changed source files: passed.
- `node node_modules/eslint/bin/eslint.js .`: NOT VERIFIED locally because the existing `eslint-config-next` and Rushstack patch compatibility error prevents standalone ESLint from loading.

## 風險或阻礙

- Standalone local ESLint is blocked by the existing Rushstack patch compatibility issue. Production build still completed and typecheck passed.
- The worktree uses a local `node_modules` junction for verification only; it is ignored and must not be committed.
- Production verification must be done after merge because local completion is not online implementation.

## 下一個 AI 的操作

1. Run `node scripts/ai-collaboration.mjs check`.
2. Commit the focused changes.
3. Push `codex/marketplace-ui-status-polish`.
4. Open and merge the PR after required checks pass.
5. Verify `/api/health/release` reports the merged SHA.
6. Run release smoke with `RELEASE_BASE_URL=https://bookflow-green.vercel.app` and `EXPECTED_COMMIT=<merged-sha>`.

## 最後基準 Commit

`a4ad6f7c34702d4c21317d86b9548755d604bb01`
