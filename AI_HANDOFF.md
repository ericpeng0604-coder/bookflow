# BookFlow AI Handoff

## 目前目標

Harden the BookFlow release workflow so future deployments use a fixed low-token path: readable handoff sections, explicit local release environment diagnostics, stale-branch preflight checks, and remote production proof through `/api/health/release` plus `release-smoke`.

## 重要背景與決策

- Branch: `codex/release-flow-hardening`.
- Base commit: `6a24bfa90ddd06a67729137fa30125194c32fa70`.
- This is release tooling and documentation only; no product runtime behavior is changed.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.
- Keep the existing npm/package-lock workflow; do not introduce pnpm as a local workaround.

## 已完成

- Added a shared handoff contract with the required `AI_HANDOFF.md` sections.
- Rebuilt `scripts/ai-collaboration.mjs` with readable messages and a `draft` command.
- Added `release:doctor` to report `node`, `npm`, lockfile, `node_modules`, and `.next` state.
- Expanded `release:plan` and `release:preflight` with clearer low-token guidance and package-manager safeguards.
- Updated release workflow documentation and added a release-flow regression check.
- Added `LESSON-043` to `AI_WORK_MANUAL.md`.

## 剩餘工作

1. Run local validation.
2. Commit the scoped release-flow changes.
3. Run `node scripts/release-preflight.mjs`.
4. Open a PR and wait for required checks.
5. Merge and verify the production release if the user asks to deploy this tooling change.

## 修改範圍

- `scripts/ai-collaboration.mjs`
- `scripts/lib/handoff-contract.mjs`
- `scripts/lib/release-environment.mjs`
- `scripts/release-plan.mjs`
- `scripts/release-preflight.mjs`
- `scripts/release-doctor.mjs`
- `scripts/check-release-flow.mjs`
- `scripts/run-project-checks.mjs`
- `.ai/templates/handoff.md`
- `docs/RELEASE_WORKFLOW.md`
- `AI_WORK_MANUAL.md`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260703-release-flow-hardening.md`

## 驗證結果

- `node --check scripts/ai-collaboration.mjs scripts/release-plan.mjs scripts/release-preflight.mjs scripts/release-doctor.mjs scripts/check-release-flow.mjs scripts/lib/handoff-contract.mjs scripts/lib/release-environment.mjs`: passed.
- `node -e "JSON.parse(...package.json...)"`: passed.
- `node scripts/check-release-flow.mjs`: passed.
- `node scripts/ai-collaboration.mjs check`: passed.
- `node scripts/release-doctor.mjs`: passed.
- `node scripts/release-plan.mjs`: passed.
- `git diff --check`: passed.
- `node scripts/check-workflows.mjs`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node scripts/release-preflight.mjs`: passed after commit.
- `tsc --noEmit`: passed using a temporary `node_modules` junction to the main checkout's npm-created dependency tree.
- `eslint .`: passed using the same temporary dependency junction.
- `next build`: passed using the same temporary dependency junction.

## 風險或阻礙

- The active original checkout has unrelated local edits, so this work is isolated in a clean worktree.
- Local `npm` may be missing from PATH in Codex desktop; use the bundled Node runtime for repo scripts and preserve `package-lock.json`.

## 下一個 AI 的操作

1. Open a PR if the user wants this tooling change published.
2. Merge after required checks pass.
3. Verify production with `/api/health/release` and `release-smoke` if the user asks to deploy this tooling release.

## 最後基準 Commit

- Base commit: `6a24bfa90ddd06a67729137fa30125194c32fa70`.
- Current implementation commit before final amend: pending.
