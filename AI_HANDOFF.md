# BookFlow AI Handoff

## 任務目標

BookFlow zero-giveaway UI release

## 目前狀態與背景

- Task ID: `20260722-bookflow-ui-release`.
- Task: `Deploy cumulative BookFlow listing and meetup UI fixes`.
- Branch: `codex/deploy-bookflow-fixes-20260722`.
- Base commit: `adffbaa79902c90e20a73bf0fd803465b319dc1b`.
- History: `.ai/history/20260722-bookflow-ui-release.md`.
- No database migration is included in this release.
- No workflow, database migration, or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`; this is not a rollback/recovery change.

## 已完成

- Removed duplicate market navigation entries while preserving the market switch.
- Hid the native file-input row, delayed book AI recognition UI until after upload, and moved helper copy into a floating tooltip with one recognition action.
- Applied the three meetup modes to books and secondhand listings, showing the location field only for the fixed-location mode.
- Preserved giveaway labels, validation, listing mappers, migrations, and unrelated workspace changes.

## 下一步

1. Run the local release checks and production build.
2. Commit and push this clean release branch, then open a PR.
3. Wait for required GitHub checks and merge the PR.
4. Trigger `Release Production` with the exact `origin/main` SHA.
5. Verify `/api/health/release`, `release-smoke`, and the visible production release marker.

## 變更檔案

- `components/marketplace-app.tsx`
- `app/globals.css`
- `scripts/check-listing-navigation-ui.mjs`, `scripts/check-meetup-modes.mjs`
- `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/20260722-bookflow-ui-release.md`

## 驗證結果

- BookFlow Release Center local source, contract, test, and quality stages passed for the dirty source fingerprint before clean isolation.
- Clean worktree was created from `origin/main` and contains only the cumulative UI fixes listed above.
- Targeted listing navigation, meetup-mode, giveaway-flow, and diff checks passed in the clean worktree.
- Full typecheck, lint, project checks, and production build remain to be recorded for this release candidate.
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

- Base commit: `adffbaa79902c90e20a73bf0fd803465b319dc1b`.
- Current implementation commit before final commit: `not committed yet`.
