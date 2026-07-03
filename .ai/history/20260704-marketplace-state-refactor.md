# AI Handoff Archive

- Task: marketplace navigation state refactor
- Actor: codex
- Status: handoff
- Base commit: `3c68d05adb0f7151ea2befdf19175e17b456297a`
- Archived at: 2026-07-04T01:32:54+08:00

---

# BookFlow AI Handoff

## 任務目標

Refactor the marketplace navigation state so URL restore, browser back handling, selected book routing, dashboard tab routing, and chat deep links are managed by one dedicated navigation hook.

## 目前狀態與背景

- Branch: `codex/marketplace-state-refactor`.
- Base commit: `3c68d05adb0f7151ea2befdf19175e17b456297a`.
- This is a UI/runtime refactor; no product feature or database behavior is intentionally changed.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added `components/marketplace/navigation-state.ts`.
- Moved marketplace URL building, initial route restore, `popstate` restore, dashboard chat deep-link handling, and last-chat restore into `useMarketplaceNavigation`.
- Removed the duplicated URL restore/write effects from `components/marketplace-app.tsx`.
- Replaced `openBook` and `returnToMarket` manual `URLSearchParams` / `history.pushState` logic with navigation hook actions.
- Added a route-restore guard so initial deep-link restoration does not get overwritten by stale URL state during the same effect pass.
- Added `openDashboardTab` so listing save, chat open, and notification navigation use one dashboard-tab action.
- Updated `scripts/check-home-accessibility.mjs` so the refresh/deep-link assertion follows the new navigation helper.
- Updated `AI_WORK_MANUAL.md` LESSON-002 after a local PowerShell rewrite briefly corrupted Chinese text during this refactor; the corrupted file was restored before final implementation.

## 下一步

1. Commit the scoped refactor and handoff trio.
2. Run `node scripts/release-preflight.mjs`.
3. Push the branch and open a PR.
4. Wait for required GitHub release gates.
5. Merge and verify production with the merged SHA through `/api/health/release` and `release:smoke`.

## 變更檔案

- `components/marketplace/navigation-state.ts`
- `components/marketplace-app.tsx`
- `scripts/check-home-accessibility.mjs`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260704-marketplace-state-refactor.md`

## 驗證結果

- `node node_modules/typescript/bin/tsc --noEmit`: passed with bundled Node.
- `node scripts/check-home-accessibility.mjs`: passed, 26/26.
- `node scripts/check-chat-switching.mjs`: passed, 4/4.
- `node scripts/check-notification-refresh.mjs`: passed, 6/6.
- `node scripts/check-chat-listing-order-ux.mjs`: passed, 13/13.
- `node scripts/check-react-doctor.mjs`: passed after bundled runtime PATH setup; score 48 Critical, 0 errors, 86 warnings.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node node_modules/next/dist/bin/next build`: passed.
- `git diff --check`: passed.

## 風險與注意事項

- The active source checkout still has unrelated uncommitted work on another branch; this release uses the clean worktree at `codex-2-marketplace-state-refactor`.
- `pnpm install --lockfile=false --shamefully-hoist` was used only to create local verification dependencies in this worktree; no lockfile or dependency manifest change is part of this release.
- React Doctor improved from the earlier clean scan baseline of 40 / 105 warnings to 48 / 86 warnings, but it remains Critical; continue with the next planned refactor batch after this release.
- No production proof exists until this PR is merged and the production health endpoint reports the merged SHA.

## 下一位 AI 工作指引

1. Keep this PR scoped to navigation state refactoring and the handoff/manual updates.
2. Do not touch protected recovery files or add the rollback approval trailer.
3. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` and `node scripts/release-preflight.mjs` after the commit is ready.
4. Use direct GitHub status scripts and `/api/health/release` for deployment proof.
5. After production verification, start the next problem-finding pass from React Doctor and local regression evidence.

## 相關 Commit

- Base commit: `3c68d05adb0f7151ea2befdf19175e17b456297a`.
- Current implementation commit before final commit: `not committed yet`.
