# AI 交接歷史

- 任務：deploy release workflow and verification tooling
- 執行者：codex
- 狀態：完成
- 基準 Commit：`2b406e33d502ad5d75f663232e40a5583ee9f3cf`
- 封存時間：2026-06-14T11:39:16.463Z

---
# BookFlow AI Handoff

## 目前目標

將已完成但尚未上線的發布流程強化與自動化驗證工具，安全整合到最新
`main` 並部署到正式環境。

## 重要背景與決策

- 從最新 `origin/main` 建立乾淨 worktree，未帶入原工作區的既有修改。
- 發布流程分支與測試工具分支都落後最新主分支，因此採逐筆 cherry-pick
  與衝突審查，不直接合併舊分支。
- 受保護的 rollback 與 recovery guard 修改維持獨立提交，並包含
  `Rollback-Workflow-Approved: true`。
- 新增的 legacy baseline migration 為 no-op，本次 PR 不觸發 staging
  migration；未來任何真正的版本化 migration 仍會強制進入 staging gate。
- 新測試需要 Node TypeScript strip-types，因此 CI 與 rollback validation
  統一使用 Node 22。

## 已完成

- 新增 Release Readiness、Staging Migration、Production Migration 與
  Production Deployment Monitor workflows。
- 新增 `/api/health/release`、production smoke、staging RPC/RLS 檢查及
  workflow 結構與回滾模擬。
- 回滾流程改用 first-parent 選版，保留受保護救援檔案，並等待 Vercel。
- recovery guard 現在同時保護 rollback workflow、自身與 CODEOWNERS。
- 整合 favorites、notification delivery 與強化版 refresh guard 檢查。
- 統一驗證已包含交易、聊天、通知、推播、容量與發布流程共 11 組檢查。
- 修正 Node 20 與 strip-types 不相容問題。

## 驗證結果

- Project checks：11/11 通過。
- TypeScript `tsc --noEmit` 通過。
- ESLint：0 errors，保留 3 個既有圖片 warnings。
- Next.js production build 通過，包含 `/api/health/release`。
- Workflow 結構、連續回滾選版與受保護檔案恢復模擬通過。
- `git diff --check` 通過。
- AI handoff CI 檢查需在本交接提交後再次執行。

## 剩餘工作

1. 推送 `codex/deploy-release-workflow` 並建立 PR。
2. 等待 Release Readiness、Staging Migration、Vercel 與既有檢查通過。
3. 合併後確認 Vercel Production 指向新的 merge commit。
4. 驗證 `/api/health/release`、首頁及 marketplace count。
5. GitHub 尚無獨立 `staging` 與 `production-database` environments；
   在取得獨立 staging Supabase 與資料庫連線 secrets 後再啟用 migration
   environments 與對應 main ruleset required checks。

## 修改範圍

- `.github/workflows/`
- `scripts/`
- `supabase/migrations/` 與 `supabase/config.toml`
- `app/api/health/release/route.ts`
- `docs/RELEASE_WORKFLOW.md`
- `README.md`、`package.json`、`AI_WORK_MANUAL.md`
- AI 交接歷史

## 風險或阻礙

- 不可把 production Supabase 當作 staging 使用。
- 尚未提供獨立 staging database URL 與 secrets，因此 migration gate
  workflow 已部署但無法對真正的 migration 完成 staging 驗證。
- 正式資料庫本次沒有 schema 變更，不需要執行 Production Migration。

## 下一個 AI 的操作

1. 完成 PR、合併與 Vercel production 驗證。
2. 建立獨立 staging 基礎設施後，配置 GitHub environments 與 secrets。
3. 確認新 workflows 實際成功後再把它們加入 main ruleset required checks。

## 最後基準 Commit

`1818b15`（建立發布分支時的 `origin/main`）。
