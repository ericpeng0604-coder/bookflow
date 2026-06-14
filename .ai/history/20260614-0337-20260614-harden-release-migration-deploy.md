# AI 交接歷史

- 任務：harden release migration deployment and recovery workflows
- 執行者：codex
- 狀態：完成
- 基準 Commit：`75802032de4bc702ed635bd2daff574a5e35794c`
- 封存時間：2026-06-14T03:37:57.194Z

---
# BookFlow AI Handoff

## 目前目標

強化修改功能後的 PR、Staging migration、正式部署驗證與一鍵回滾流程。

## 重要背景與決策

- GitHub 必須自行重跑 typecheck、lint、功能檢查、workflow 語法與 build。
- 資料庫改用 `supabase/migrations/` 時間戳 migration，先 Staging 再 Production。
- Production database workflow 與正式部署仍需要個別明確核准。
- 應用程式回滾只沿 `main` first-parent 歷史，且不修改資料庫或救援檔案。
- 救援系統修改已由使用者明確授權，受保護 commit 必須帶
  `Rollback-Workflow-Approved: true`。

## 已完成

- 新增 `Release Readiness`、`Staging Migration`、`Production Migration`
  與 `Production Deployment Monitor` workflows。
- 新增統一 `check:all`、workflow 檢查、Staging RPC/RLS 檢查與 release smoke。
- 新增 `/api/health/release`，可核對 Vercel 部署 commit。
- 建立 Supabase migration baseline、設定檔與發布操作文件。
- 回滾改用 first-parent 選版，連續回滾會跳過已撤銷版本。
- 救援 guard 同時監控 rollback workflow、自身與 CODEOWNERS。
- 應用程式回滾會保留目前救援檔案，不會將它們一起降版。
- README 與 AI 工作手冊已補上新的完成定義與事故預防規則。

## 剩餘工作

1. 建立新分支與隔離 commits，救援 commit 加入指定 trailer。
2. 推送 PR 並等待新 workflows 在 GitHub 實際執行。
3. 在 GitHub 建立 `staging` 與 `production-database` Environments 及 secrets。
4. 更新 main ruleset，要求 Release Readiness、Staging Migration 與 Vercel。
5. 建立獨立 Supabase/Vercel Staging，驗證 baseline 後標記 migration history。

## 修改範圍

- `.github/workflows/`
- `scripts/`
- `supabase/migrations/` 與 `supabase/config.toml`
- `app/api/health/release/route.ts`
- `docs/RELEASE_WORKFLOW.md`、README 與 AI 工作手冊
- 受保護的 rollback 與 recovery guard workflows

## 驗證結果

- TypeScript 通過。
- ESLint 0 errors；保留原有 3 個非阻擋圖片警告。
- Next.js production build 通過，包含 `/api/health/release`。
- 8/8 project checks 通過。
- actionlint 1.7.12 檢查全部 workflow 通過。
- 連續回滾選版與三個受保護檔案恢復模擬通過。
- 本機 release smoke：首頁、count API、release health 全部通過。
- UTF-8 與 `git diff --check` 通過。

## 風險或阻礙

- 尚未配置 Staging/Production GitHub Environment secrets，因此遠端 migration
  workflow 尚未執行。
- 尚未取得已登入 GitHub API 的管理權限，main ruleset 尚未在線更新。
- 目前工作樹另有使用者尚未提交的 marketplace 修改，提交時不可混入。
- Production migration 與 production deployment 未獲本次獨立環境核准，不執行。

## 下一個 AI 的操作

1. 僅提交本 handoff 所列的發布流程檔案，保留其他工作樹修改。
2. 受保護救援檔案使用獨立 commit 與授權 trailer。
3. 從最新 `origin/main` 建立乾淨分支並 cherry-pick 隔離 commits。
4. 推送 PR，確認所有新狀態實際成功後再調整 ruleset。
5. 取得明確環境核准後才建立 secrets、執行 Staging 或 Production migration。

## 最後基準 Commit

`8109eaa`（目前 `origin/main`）
