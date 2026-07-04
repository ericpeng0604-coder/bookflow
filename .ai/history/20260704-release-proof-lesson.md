# AI Handoff Archive

- Task: release proof lesson
- Actor: codex
- Status: handoff
- Base commit: `203190213717a297f4e07929ee12138808f8a2c6`
- Archived at: 2026-07-04T21:05:00+08:00

---

# BookFlow AI Handoff

## 任務目標

Record the production-release proof lesson from PR #74 so future agents do not
confuse a dirty local worktree with the clean branch that actually shipped.

## 目前狀態與背景

- Branch: `codex/release-proof-lesson`.
- Base commit: `203190213717a297f4e07929ee12138808f8a2c6`.
- This is a documentation and workflow-memory release only.
- No runtime application behavior is changed.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Updated `LESSON-046` in `AI_WORK_MANUAL.md`.
- Preserved the existing clean-worktree guidance.
- Added the missing release-proof rule: verify the actual shipping PR, merge
  commit, GitHub Actions, Vercel status, production migration, and smoke result
  before claiming a BookFlow release is deployed or blocked.
- Explicitly warns agents not to infer production state from the currently open
  dirty worktree.

## 下一步

1. Commit this scoped lesson update.
2. Run the AI handoff and release preflight checks.
3. Push and open a PR.
4. Merge after required checks pass.

## 變更檔案

- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260704-release-proof-lesson.md`

## 驗證結果

- `git diff --check`: passed.
- `node scripts/ai-collaboration.mjs check`: passed.
- `node scripts/ai-collaboration.mjs check-ci origin/main HEAD`: passed.
- `node scripts/release-preflight.mjs`: passed.

## 風險與注意事項

- PR #74 shipped from `codex/marketplace-ui-flow-release` and merged as
  `203190213717a297f4e07929ee12138808f8a2c6`.
- The currently open `codex/release-preflight-speedup` worktree can remain dirty;
  it is not the source of truth for PR #74 production state.
- This branch intentionally isolates only the lesson and handoff updates.

## 下一位 AI 工作指引

1. Keep this PR scoped to the release-proof lesson and handoff updates.
2. Do not touch protected recovery files or add the rollback approval trailer.
3. Use the shipping PR, merge commit, workflow runs, Vercel status, and
   release smoke as production release evidence.

## 相關 Commit

- Base commit: `203190213717a297f4e07929ee12138808f8a2c6`.
- Current implementation commit before final commit:
  `af76bb01b00ef1d292fc4fbc4fef952f65b13c18`.
