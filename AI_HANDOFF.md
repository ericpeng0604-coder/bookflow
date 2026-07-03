# BookFlow AI Handoff

## 任務目標

Reduce BookFlow release wait time and token use without lowering verification quality by adding a required-check PR status helper, documenting remote merge for multi-worktree setups, and repairing readable handoff/workflow names.

## 目前狀態與背景

- Branch: `codex/release-pr-status-helper`.
- Base commit: `574e5405356b44945de46075d379298ce2c27856`.
- This is release tooling and documentation only; no product runtime behavior is changed.
- No database migration is included.
- No protected recovery file is changed.
- `.github/workflows/check-ai-handoff.yml` is changed only to repair the readable status name `AI 交接完整性`.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added `scripts/release-pr-status.mjs` to poll GitHub required checks plus BookFlow release gates and stop without waiting for optional review bots.
- Added `release:pr-status` to `package.json`.
- Updated `release:plan` to recommend compact required-check polling, remote merge, merged-SHA lookup, production health, and `release-smoke`.
- Rebuilt `docs/RELEASE_WORKFLOW.md` with readable required-check names, compact PR polling, remote merge guidance, and production proof steps.
- Rebuilt `.ai/templates/handoff.md` and `scripts/lib/handoff-contract.mjs` with readable Chinese section names.
- Rebuilt `.github/workflows/check-ai-handoff.yml` with readable workflow/job names.
- Added `LESSON-044` to `AI_WORK_MANUAL.md`.

## 下一步

1. Run local release-flow, workflow, project, and preflight checks.
2. Commit the scoped release-flow changes.
3. Open a PR and use `node scripts/release-pr-status.mjs <pr> --wait` instead of waiting for optional checks.
4. Merge remotely and verify production with `/api/health/release` plus `release-smoke`.

## 變更檔案

- `.ai/templates/handoff.md`
- `.github/workflows/check-ai-handoff.yml`
- `.ai/state.json`
- `.ai/history/20260703-release-pr-status-helper.md`
- `AI_HANDOFF.md`
- `AI_WORK_MANUAL.md`
- `docs/RELEASE_WORKFLOW.md`
- `package.json`
- `scripts/check-release-flow.mjs`
- `scripts/lib/handoff-contract.mjs`
- `scripts/release-plan.mjs`
- `scripts/release-pr-status.mjs`

## 驗證結果

- Bundled Node syntax checks for changed release scripts: passed.
- `node scripts/check-release-flow.mjs`: passed.
- `node scripts/ai-collaboration.mjs check`: passed.
- `node scripts/release-plan.mjs`: passed.
- `git diff --check`: passed.
- `node scripts/check-workflows.mjs`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node scripts/release-pr-status.mjs 65`: passed and reported all release gates green.
- `tsc --noEmit`: passed using a temporary `node_modules` junction to the main checkout's npm-created dependency tree.
- `eslint .`: passed using the same temporary dependency junction.
- `next build`: passed using the same temporary dependency junction.

## 風險與注意事項

- The active original checkout has unrelated local edits, so this work is isolated in a clean worktree.
- The change intentionally keeps verification quality: it reduces repeated polling/log reading, not required checks.
- Local `npm` may be missing from PATH in Codex desktop; use Node scripts directly when needed.
- The temporary `node_modules` junction and `.next` build output were removed after verification.

## 下一位 AI 工作指引

1. Keep this release scoped to release workflow tooling and documentation.
2. Do not touch protected recovery files or add the rollback approval trailer.
3. After PR creation, run `node scripts/release-pr-status.mjs <pr> --wait` and merge only after required checks pass.
4. Verify the deployed merged SHA with `/api/health/release` and `release-smoke`.

## 相關 Commit

- Base commit: `574e5405356b44945de46075d379298ce2c27856`.
- Current implementation commit before final commit: `not committed yet`.
