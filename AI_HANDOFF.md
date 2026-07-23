# BookFlow AI Handoff

## 任務目標

Optimize strict release preflight

## 目前狀態與背景

- Task ID: 20260723-optimize-strict-release-preflight.
- Task: Optimize strict release preflight.
- Branch: agent/optimize-release-preflight-20260723.
- Base commit: 0a65850fb04cb9afae751e8e6f8a616096eb3e6f.
- History: .ai/history/20260723-optimize-strict-release-preflight.md.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add Rollback-Workflow-Approved: true unless this is an authorized rollback/recovery change.

## 已完成

- Implemented strict dirty-tree blocking in release-preflight with an explicit diagnostic-only --allow-dirty override.
- Added release-flow contract coverage and documented the safe usage.

## 下一步

1. Run the required local checks.
2. Commit, run node scripts/release-preflight.mjs, then open a PR.
3. After merge, verify the protected release workflow, /api/health/release, and release-smoke.

## 變更檔案

- scripts/release-preflight.mjs
- scripts/check-release-flow.mjs
- docs/RELEASE_WORKFLOW.md
- AI_HANDOFF.md
- .ai/state.json
- .ai/history/20260723-optimize-strict-release-preflight.md

## 驗證結果

- Strict mode stops on dirty tracked or untracked entries; --allow-dirty diagnostic mode exits successfully.
- Release flow checks pass.
- PR, merge, production deployment, health, smoke, and browser proof are pending.

## 風險與注意事項

- Do not use --allow-dirty as release evidence.
- Keep the clean worktree and exact origin/main base guardrails.

## 下一位 AI 工作指引

1. Keep AI_HANDOFF.md, .ai/state.json, and the matching .ai/history archive synchronized.
2. Run node scripts/ai-collaboration.mjs check-ci origin/main HEAD before opening or merging the PR.
3. Use the protected release workflow only with the exact full merged main SHA.

## 相關 Commit

- Base commit: 0a65850fb04cb9afae751e8e6f8a616096eb3e6f.
- Current implementation commit: 2490126.
