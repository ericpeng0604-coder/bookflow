# BookFlow AI Handoff

## 任務目標

修正 GitHub CodeQL 在 BookFlow 預設分支發現的 JavaScript/TypeScript 安全與程式品質告警，保留 CodeQL 為非阻塞的獨立掃描，不修改部署或受保護的復原流程。

## 目前狀態與背景

- Branch: `codex/codeql-security-fixes`.
- Base commit: `e333579312e455d3375cfc0a3fb291d9fde05f4f`.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- The original dirty checkout is outside this worktree and remains untouched.

## 已完成

- 加入圖片來源協定與路徑白名單，降低 DOM image sink 的 XSS 風險。
- 修正通知 API 的安全屬性存取、非同步錯誤結果的區域變數，以及檔案歸檔的 check-then-write race。
- 將 CodeQL 指出的正則表達式改為具明確錨點，限制健康檢查的遠端探測只使用 process.env，且健康檢查輸出只記錄固定的狀態與區域名稱。
- 移除沒有任何引用點的舊學生證 helper 與卡片元件。

## 下一步

1. 建立 PR 並等待 GitHub quality checks 與 CodeQL 掃描。
2. 檢查預設分支的 Code Scanning 告警是否已清除；若仍有確認過的誤報，再以具體理由關閉。

## 變更檔案

- `components/marketplace-app.tsx`
- `app/api/cron/listing-lifecycle/route.ts`
- `scripts/ai-collaboration.mjs`
- `scripts/check-book-ocr-ai.mjs`
- `scripts/check-site-quality-hardening.mjs`
- `scripts/lib/check-runner.mjs`
- `scripts/setup-health-check.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-codeql-security-fixes.md`

## 驗證結果

- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/check-workflows.mjs`: passed.
- `node scripts/check-refresh-guard.mjs`: passed.
- `node --check` on changed `.mjs` files: passed.
- `git diff --check`: passed.
- GitHub CodeQL PR scan: pending.

## 風險與注意事項

- 本次沒有修改部署 workflow、資料庫 migration 或 protected recovery files。
- pnpm 的依賴安裝需要使用隔離 worktree 的本地 runtime；未把 lockfile 或依賴目錄納入提交。

## 下一位 AI 工作指引

1. 先檢查 PR checks 與 CodeQL alert 結果，再決定是否需要處理剩餘告警。
2. 保持 `AI_HANDOFF.md`、`.ai/state.json` 與 `.ai/history/*.md` 同步。

## 相關 Commit

- Base commit: `e333579312e455d3375cfc0a3fb291d9fde05f4f`.
- Current implementation commit before final commit: not committed yet.
