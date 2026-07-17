# BookFlow AI Handoff

## 任務目標

修復專案記憶入口與一致性問題，並發布自動檢查，避免工具遺失、lesson
編號重複或 handoff/state 互相矛盾後仍被 AI 當成可信狀態。

## 目前狀態與背景

- Task ID: `20260717-memory-consistency-hardening`.
- Task: `harden project memory consistency`.
- Branch: `codex/memory-consistency-hardening`.
- Base commit: `08b609752e95635d38502b8e778594760e4ee634`.
- History: `.ai/history/20260717-memory-consistency-hardening.md`.
- This clean worktree was created from the latest fetched `origin/main`.
- No database migration or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Restored the missing low-output lookup and improvement helpers.
- Added one memory contract for script targets, lesson IDs, Git provenance, readability, and handoff/state alignment.
- Connected the contract and its regression tests to the project check runner and AI handoff validator.
- Added concise AI startup routing and removed duplicate lesson identifiers.

## 下一步

1. Run focused and project checks in this clean worktree.
2. Commit only the listed memory-consistency files and run release preflight.
3. Push, open a PR, wait for required checks, and merge to `main`.
4. Confirm the merged `main` contains the memory contract; no Vercel or Supabase deployment proof is required.

## 變更檔案

- `AGENTS.md`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/templates/handoff.md`
- `.ai/history/20260717-memory-consistency-hardening.md`
- `package.json`
- `scripts/ai-collaboration.mjs`
- `scripts/ai-lookup.mjs`
- `scripts/ai-improve.mjs`
- `scripts/check-memory.mjs`
- `scripts/run-project-checks.mjs`
- `scripts/lib/handoff-contract.mjs`
- `scripts/lib/memory-contract.mjs`
- `tests/memory-contract.test.mjs`

## 驗證結果

- `node scripts/check-memory.mjs`: passed; 66 unique lessons, 83 script targets, handoff/state aligned.
- `node scripts/ai-collaboration.mjs check`: passed.
- `node --test tests/memory-contract.test.mjs`: passed, 4/4.
- `node scripts/run-project-checks.mjs`: passed, 31/31.
- TypeScript typecheck: passed.
- ESLint: passed with zero warnings.
- Next.js production build: passed.
- Windows Codex runtime path for `check-memory.mjs`: passed.
- `node scripts/release-preflight.mjs`: passed on the clean release commit.
- `node scripts/ai-collaboration.mjs check-ci origin/main HEAD`: passed.
- Production website deployment: not required for repository-only AI tooling.

## 風險與注意事項

- This change affects repository AI coordination and CI checks, not application runtime behavior.
- The contract must remain executable on Node 22 in GitHub Actions and through the Windows Codex runtime helper.
- A passing memory contract proves coordination consistency, not production application behavior.

## 下一位 AI 工作指引

1. Run `node scripts/check-memory.mjs` before trusting this handoff.
2. Start memory searches with `node scripts/ai-lookup.mjs <task keywords>` and use `--deep` only for a concrete history need.
3. Preserve all protected recovery files.

## 相關 Commit

- Base commit: `08b609752e95635d38502b8e778594760e4ee634`.
- Current implementation commit before final commit: `not committed yet`.
