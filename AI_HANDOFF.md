# BookFlow AI Handoff

## 任務目標

加入獨立且不阻擋部署的 CodeQL JavaScript/TypeScript 安全掃描。

## 目前狀態與背景

- Branch: `codex/codeql-nonblocking`。
- Base commit: `3e2dd548a8e6e5802aa0398e09e5d86a867b7694`（`origin/main`）。
- 本次只新增 `.github/workflows/codeql-nonblocking.yml`。
- Workflow 只在 `main` push、PR、每週排程或手動觸發時執行；`push` 只會執行獨立 CodeQL job。
- 不修改部署 workflow、資料庫、應用程式程式碼或受保護 recovery 檔案。

## 已完成

- 使用 CodeQL Action v4 與 `security-and-quality` query suite 掃描 JavaScript/TypeScript。
- 設定 `continue-on-error: true`，不把 CodeQL 結果接到部署 job。
- PR #95 已建立並成功執行 CodeQL。

## 下一步

1. 完成 PR 必要檢查後合併 CodeQL workflow。
2. 確認合併後的 GitHub Code Scanning alerts。
3. 確認網站部署流程與正式環境健康檢查未受影響。

## 變更檔案

- `.github/workflows/codeql-nonblocking.yml`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-codeql-nonblocking.md`

## 驗證結果

- YAML parse: passed。
- `node scripts/check-workflows.mjs`: passed。
- GitHub Actions workflow syntax: passed。
- GitHub CodeQL run: passed。
- PR #95 CodeQL open alerts: 0。
- 初次執行只出現 action 版本與 default-branch push trigger 提醒，已在本次修正。
- 其他 PR checks 的結果需以 GitHub 最新狀態為準。

## 風險與注意事項

- CodeQL 是靜態分析，不能取代 Playwright、Sentry、RLS 權限測試或 staging DAST。
- GitHub PR 與 `main` push 仍會依專案既有設定觸發既有 release checks；本次沒有修改那些 workflow。
- 不得修改 `.github/workflows/rollback-production.yml`、`.github/workflows/protect-rollback-workflow.yml` 或 `.github/CODEOWNERS`。

## 下一位 AI 工作指引

1. 保持 CodeQL workflow 與部署 workflow 分離。
2. 修改實質檔案時同步更新 `AI_HANDOFF.md`、`.ai/state.json` 與新的 `.ai/history/*.md`。
3. 合併前重新確認 CodeQL alerts、PR checks 與 production proof，不要把 workflow 成功誤認為網站功能測試完成。

## 相關 Commit

- Base: `3e2dd548a8e6e5802aa0398e09e5d86a867b7694`。
- CodeQL implementation: `fd6b80e61a116ec51e18ebc92b9c489f36763be0`。
