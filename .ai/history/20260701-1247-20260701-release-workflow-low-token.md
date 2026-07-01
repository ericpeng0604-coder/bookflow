# AI 交接歷史

- 任務：release workflow low-token hardening
- 執行者：codex
- 狀態：交接
- 基準 Commit：`268755e4616dd531f7f5cf898f8d985db8bc33bd`
- 更新時間：`2026-07-01T04:47:00.000Z`

---

# BookFlow AI Handoff

## 目前目標

整理舊分支並發布 release workflow / low-token Codex path 修正，避免部署前反覆讀大型 dashboard、workflow log 或 browser snapshot，並讓 AI handoff workflow 的 required status 名稱保持可讀且可檢查。

## 重要背景與決策

- 原分支 `codex/split-listing-entry-ocr-volume` 已重接到最新 `origin/main`。
- 舊的 marketplace、OCR、admin OTP、README 等功能差異已在 `main` 或其他 release 中處理，這次不重新提交那些內容。
- `.cursor/mcp.json` 是本機 Cursor 設定，不納入 repo。
- `lib/marketplace/filters.ts`、`mappers.ts`、`queries.ts` 的無實質 diff 狀態噪音已清掉。
- 本次沒有 `supabase/migrations/` 變更，不需要 production database migration。
- 本次沒有修改 rollback/recovery 受保護檔案，所以不需要 `Rollback-Workflow-Approved: true` commit trailer。

## 已完成

- 新增 `scripts/release-plan.mjs`，用低輸出摘要顯示分支、HEAD、變更區域、migration/workflow/recovery 風險與最小 release gates。
- 在 `package.json` 加上 `release:plan` script。
- 修正 `.github/workflows/check-ai-handoff.yml` 的 step 名稱，避免 status-bearing workflow 內容再出現難以辨識的文字。
- 擴充 `scripts/check-workflows.mjs`，檢查 AI handoff workflow 名稱、必要 step 與 mojibake/private-use 字元。
- 更新 `docs/RELEASE_WORKFLOW.md`，加入 low-token Codex path 與 Codex Windows bundled Node fallback。
- 在 `AI_WORK_MANUAL.md` 新增 workflow/status 名稱編碼安全 lesson。

## 剩餘工作

- 等 PR #53 的 GitHub checks 全部通過。
- Merge PR #53 into `main`。
- 等 Vercel production deployment 完成。
- 用 `/api/health/release` 與 `release:smoke` 驗證 production commit。

## 修改範圍

- `.github/workflows/check-ai-handoff.yml`
- `AI_WORK_MANUAL.md`
- `docs/RELEASE_WORKFLOW.md`
- `package.json`
- `scripts/check-workflows.mjs`
- `scripts/release-plan.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260701-1247-20260701-release-workflow-low-token.md`

## 驗證結果

- bundled Node `scripts/release-plan.mjs`: passed.
- bundled Node `scripts/check-workflows.mjs`: passed.
- bundled Node `scripts/run-project-checks.mjs`: passed, 23/23 checks.
- bundled Node `node_modules/typescript/bin/tsc --noEmit`: passed.
- bundled Node `node_modules/next/dist/bin/next build`: passed; production pages generated successfully.
- `git diff --check`: passed.
- mojibake scan for workflow/release docs/work manual/check script: passed.
- `node_modules/eslint/bin/eslint.js .`: NOT VERIFIED locally because the existing local `node_modules` has the known `eslint-config-next` / Rushstack patch compatibility error. GitHub Release Readiness runs lint in a clean `npm ci` environment and is the authority for this release.

## 風險或阻礙

- Local standalone ESLint remains blocked by the local dependency patch issue, but CI `Quality and build` passed once on PR #53 before this handoff update.
- Production is not updated until PR #53 is merged and the production deployment monitor or manual smoke verifies the merged SHA.
- Staging Migration should remain a no-op because no versioned database migration changed.

## 下一個 AI 的操作

1. Run `node scripts/ai-collaboration.mjs check`.
2. Commit and push this handoff update.
3. Wait for PR #53 checks to pass.
4. Merge PR #53 into `main`.
5. Verify production deployed commit with `/api/health/release`.
6. Run release smoke against `https://bookflow-green.vercel.app` with the merged SHA.

## 最後基準 Commit

`268755e4616dd531f7f5cf898f8d985db8bc33bd`
