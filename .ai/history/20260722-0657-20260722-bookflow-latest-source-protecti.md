# AI Handoff Archive

- Task: BookFlow latest-source protection and manual production release
- Actor: codex
- Status: complete
- Base commit: `d25b52a73124f7e93f0dbb78724fb58840668e0d`
- Archived at: 2026-07-22T06:57:07.831Z

---
# BookFlow AI Handoff

## 任務目標

BookFlow latest-source protection and manual production release

## 目前狀態與背景

- Task ID: `20260722-bookflow-latest-source-protection-and-ma`.
- Task: `BookFlow latest-source protection and manual production release`.
- Branch: `codex/release-latest-source-20260722`.
- Base commit: `d25b52a73124f7e93f0dbb78724fb58840668e0d`.
- History: `.ai/history/20260722-0657-20260722-bookflow-latest-source-protecti.md`.
- No database migration is included in this release.
- Added `.github/workflows/release-production.yml`; no protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`; this is not a rollback/recovery change.

## 已完成

- Added source fingerprint tooling and `/api/health/source`.
- Added local `/release` dashboard with allowlisted visible checks.
- Added manual full-SHA production workflow with staging, approval, targeted Vercel deployment, exact-SHA release smoke, and no automatic rollback.
- Updated release documentation and project checks.

## 下一步

1. Run the local release checks and production build.
2. Commit and push this clean release branch, then open a PR.
3. Wait for required GitHub checks and merge the PR.
4. Trigger `Release Production` with the exact `origin/main` SHA.
5. Verify `/api/health/release`, `release-smoke`, and the visible production release marker.

## 變更檔案

- `.github/workflows/release-production.yml`
- `app/api/health/source/`, `app/api/release/`, and `app/release/`
- `lib/release-dashboard.ts`, `lib/release-dashboard-server.ts`
- `scripts/release-source.mjs`, `scripts/dev-latest.mjs`, and release checks
- `docs/RELEASE_WORKFLOW.md`, `docs/MONITORING.md`, and `AI_WORK_MANUAL.md`

## 驗證結果

- Clean-worktree source contract, dashboard contract, release flow, workflow structure, and memory checks passed.
- TypeScript typecheck passed; full repository lint passed; tests passed 16/16; project checks passed 31/31; production build passed.
- YAML parse passed for the release workflow. `actionlint` was not installed locally and remains a CI-only check.
- Clean-worktree live dev smoke passed: `/release` returned 200, `/api/health/source` returned commit `d25b52a73124f7e93f0dbb78724fb58840668e0d`, `check-local-source` passed, and the dashboard ran all 4 stages successfully.
- Production is not verified until the merged full SHA is reported by `/api/health/release` and `release-smoke`.

## 風險與注意事項

- Production requires repository Vercel secrets and the protected `production-database` reviewer when migrations are detected.
- A failed deployment or smoke check must stop and report `NOT VERIFIED`; use the existing rollback workflow manually if needed.
- The dashboard is workspace-only and never receives production deployment secrets.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Preserve `.github/workflows/rollback-production.yml`, `.github/workflows/protect-rollback-workflow.yml`, and `.github/CODEOWNERS`.
4. Separate local, staging, deployment, release health, and smoke evidence; report `NOT VERIFIED` when any exact-SHA proof is missing.

## 相關 Commit

- Base commit: `d25b52a73124f7e93f0dbb78724fb58840668e0d`.
- Current implementation commit before final commit: `not committed yet`.
