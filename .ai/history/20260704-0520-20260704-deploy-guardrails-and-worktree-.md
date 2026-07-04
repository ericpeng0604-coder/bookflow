# AI Handoff Archive

- Task: deploy guardrails and worktree stop rules
- Actor: codex
- Status: complete
- Base commit: `afcb626935323ea0362fcc8a7cdb661fe350e4ae`
- Archived at: 2026-07-04T05:20:35.252Z

---
# BookFlow AI Handoff

## 任務目標

Write durable deploy guardrails into the repository so future BookFlow tasks
stop early on dirty release scope and broken local runtime paths instead of
burning hours of token and setup time mid-implementation.

## 目前狀態與背景

- Branch: `codex/deploy-guardrails`.
- Base commit: `afcb626935323ea0362fcc8a7cdb661fe350e4ae`.
- This is a tooling and workflow hardening change only; no product runtime
  behavior or database schema is changed.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added a hard routing rule to `AGENTS.md`: deploy, merge, and production
  confirmation tasks must inspect `git status --short` first, move to a clean
  worktree when the active checkout is dirty, and confirm runtime readiness
  before substantial implementation.
- Added `LESSON-046` to `AI_WORK_MANUAL.md` to capture the failure mode where
  dirty scope and runtime drift were discovered after coding had already
  started.
- Added `scripts/context-budget.mjs` and `npm run ai:budget` as the lowest-cost
  triage helper for non-trivial tasks.
- Updated `docs/RELEASE_WORKFLOW.md` and `scripts/release-plan.mjs` so the
  clean-worktree stop rule and runtime stop rule are explicit in the release
  path.
- Extended `scripts/check-release-flow.mjs` to cover the new helper and the new
  release/documentation guardrails.

## 下一步

1. Review the final diff and keep the PR scoped to deploy guardrails.
2. Commit the workflow/tooling changes and updated handoff files.
3. Run `node scripts/release-preflight.mjs`.
4. Push the branch, open a PR, and wait only on the required release gates.
5. After merge, verify production with the merged SHA through
   `/api/health/release` and `release:smoke`.

## 變更檔案

- `AGENTS.md`
- `AI_WORK_MANUAL.md`
- `docs/RELEASE_WORKFLOW.md`
- `package.json`
- `scripts/context-budget.mjs`
- `scripts/release-plan.mjs`
- `scripts/check-release-flow.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`

## 驗證結果

- `node --check scripts/context-budget.mjs`: passed with bundled Node runtime.
- `node -e "JSON.parse(...package.json...)"`: passed.
- `node scripts/check-release-flow.mjs`: passed.
- `node scripts/release-plan.mjs`: passed and now prints deploy-scope and
  environment guards.
- `node scripts/context-budget.mjs`: passed and prints deploy/runtime stop rules
  plus high-context guidance.

## 風險與注意事項

- This change makes future routing stricter, but it cannot force an external
  agent to obey the rules if that agent ignores `AGENTS.md` and
  `AI_WORK_MANUAL.md`.
- Local `node` and `npm` are still absent from PATH in this environment; the
  new rules intentionally direct agents to the bundled Node runtime rather than
  changing the repo to pnpm.
- No production proof exists until the PR is merged and the production health
  endpoint reports the merged SHA.

## 下一位 AI 工作指引

1. Keep this PR scoped to deploy guardrails and low-output workflow hardening.
2. Do not touch protected recovery files or add the rollback approval trailer.
3. Use `npm run ai:budget` or `node scripts/context-budget.mjs` before broad
   exploration in future non-trivial tasks.
4. On deploy-complete work, treat a dirty checkout or unusable runtime as a
   stop rule before coding deeper.
5. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` and
   `node scripts/release-preflight.mjs` before opening or merging the PR.

## 相關 Commit

- Base commit: `afcb626935323ea0362fcc8a7cdb661fe350e4ae`.
- Current implementation commit before final commit: `not committed yet`.
