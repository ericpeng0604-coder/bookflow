# BookFlow AI Handoff

## 任務目標

Add safe post-release workspace cleanup flow

## 目前狀態與背景

- Task ID: 20260723-post-release-workspace-cleanup.
- Task: Add safe post-release workspace cleanup flow.
- Branch: agent/optimize-release-preflight-20260723.
- Base commit: 0a65850fb04cb9afae751e8e6f8a616096eb3e6f.
- History: .ai/history/20260723-post-release-workspace-cleanup.md.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add Rollback-Workflow-Approved: true unless this is an authorized rollback/recovery change.

## 已完成

- Added release-cleanup.mjs with plan-only default and explicit --apply mode.
- Cleanup is limited to clean, already-merged agent/codex worktrees and local branches.
- Dirty current worktrees, dirty candidates, main/master, current branch, release evidence, and AI history are protected.

## 下一步

1. Run syntax, release-flow, handoff, memory, project, typecheck, lint, and build checks.
2. Commit and run strict release-preflight.
3. Update the existing draft PR with the cleanup flow; do not deploy this tooling-only change.

## 變更檔案

- scripts/release-cleanup.mjs
- scripts/check-release-flow.mjs
- package.json
- docs/RELEASE_WORKFLOW.md
- AI_HANDOFF.md
- .ai/state.json
- .ai/history/20260723-post-release-workspace-cleanup.md

## 驗證結果

- Cleanup plan is safe by default; --apply is explicit and uses git worktree remove without force.
- Cleanup refuses a dirty current worktree and requires the release SHA to be merged into the base ref.
- Full verification is pending.

## 風險與注意事項

- Never use --apply until the exact candidate list is reviewed.
- Do not use git clean, reset --hard, or delete release evidence, AI history, or the original dirty checkout.

## 下一位 AI 工作指引

1. Keep AI_HANDOFF.md, .ai/state.json, and the matching .ai/history archive synchronized.
2. Run node scripts/ai-collaboration.mjs check-ci origin/main HEAD before opening or merging the PR.
3. Do not trigger production deployment for this tooling-only change.

## 相關 Commit

- Base commit: 0a65850fb04cb9afae751e8e6f8a616096eb3e6f.
- Current implementation commit before final commit: not committed yet.
