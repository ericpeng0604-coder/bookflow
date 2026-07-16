# BookFlow AI Handoff

## 任務目標

Harden the BookFlow deployment flow so migration evidence, release gates,
Windows helper commands, and production version monitoring cannot silently
report a false release success.

## 目前狀態與背景

- Branch: `codex/release-flow-hardening-20260716`.
- Base commit: `3fb323823cdf2ecd6a67c666e8af7dd5736b9cd4` (`origin/main`).
- This release changes deployment workflow checks, release tooling, docs, and
  AI workflow metadata only.
- No database migration or protected recovery file is included.
- Production deployment is pending PR checks, merge, and post-merge smoke.

## 已完成

- Production migration now requires a full commit SHA and a successful Staging
  Migration run for that exact SHA.
- Staging RPC probes now assert expected authorization status and JSON shape.
- Scheduled production uptime smoke now checks the deployed commit against the
  current `main` commit.
- Release tooling now uses the npm lockfile and includes the Windows bundled-Node
  wrapper used by the `:codex` scripts.
- Workflow and release-flow checks cover the new provenance and monitoring
  guards.

## 下一步

1. Run the local release-flow and project checks in the isolated worktree.
2. Run release preflight, commit, push, and open the PR.
3. Wait for required checks, merge only after they pass, then verify the Vercel
   deployment commit and production smoke.

## 變更檔案

- `.github/workflows/check-ai-handoff.yml`
- `.github/workflows/production-migration.yml`
- `.github/workflows/production-uptime-smoke.yml`
- `scripts/check-release-flow.mjs`
- `scripts/check-staging.mjs`
- `scripts/check-workflows.mjs`
- `scripts/lib/release-environment.mjs`
- `scripts/release-plan.mjs`
- `scripts/run-node.ps1`
- `package.json`
- `docs/RELEASE_WORKFLOW.md`
- `docs/MONITORING.md`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-release-flow-hardening.md`

## 驗證結果

- Workflow structure and rollback selection: pending.
- Release-flow checks: pending.
- Typecheck, lint, project checks, and production build: pending.
- Staging and production database operations: not run from this local worktree.

## 風險與注意事項

- The existing user checkout is dirty and mixed; it was intentionally not
  included in this release branch.
- Production Migration requires the staging workflow run ID for the same commit.
- Production deployment proof remains separate from migration history; verify
  `/api/health/release` and `release-smoke` after deployment.

## 下一位 AI 工作指引

1. Preserve the exact migration SHA and staging run ID relationship.
2. Do not add mutable branch names back to `migration_ref`.
3. Keep `package-lock.json`, npm CI, and release helper output aligned.
4. Use the compact PR status helper and report any unavailable check as
   `NOT VERIFIED`.

## 相關 Commit

- Base commit: `3fb323823cdf2ecd6a67c666e8af7dd5736b9cd4`.
- Current implementation commit before final commit: not committed yet.
