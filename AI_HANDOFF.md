# BookFlow AI Handoff

## 任務目標

Deploy the mobile chat scroll fix so tapping a conversation in the left chat
rail no longer moves the whole page to the bottom.

## 目前狀態與背景

- Branch: `codex/mobile-chat-page-scroll`.
- Base commit: `3877a9e0ddbca67ad8aaa10c4063ade6c61b6992` (`origin/main`).
- This release is scoped to marketplace chat scrolling and regression
  documentation.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added page-scroll restoration for conversation-list selections on all
  viewport widths.
- Replaced chat bottom-sentinel `scrollIntoView` usage with
  `scrollChatLogToBottom(...)`, which scrolls only the chat message container.
- Updated `check-chat-listing-order-ux.mjs` to assert both the local chat-log
  scroll behavior and page-scroll preservation.
- Added work-manual lessons for mobile chat viewport preservation and for
  package-manager-aware clean release worktrees.
- Added an ad-hoc memory update for the deploy token waste discovered during
  this run.

## 變更檔案

- `components/marketplace-app.tsx`
- `scripts/check-chat-listing-order-ux.mjs`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260705-mobile-chat-page-scroll.md`

## 驗證結果

- `node scripts/check-chat-listing-order-ux.mjs`: passed, 21/21.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node node_modules/next/dist/bin/next build`: passed.
- Protected recovery files were checked and are unchanged.

## 風險與注意事項

- The Codex shell has `node` but not `npm`; the clean worktree is npm-lock based.
- A read-only local `node_modules` junction to the existing checkout was used
  for verification only. Do not run a package manager through this worktree
  while that junction exists.
- The initial verification attempt wasted time by trying pnpm-based Codex
  commands on an npm-lock baseline; this is now recorded in `AI_WORK_MANUAL.md`
  and in the global memory update note.

## 下一步

1. Commit the scoped branch.
2. Run `node scripts/release-preflight.mjs`.
3. Push and open a PR.
4. Wait for PR checks and Vercel Preview.
5. Merge, wait for production deployment, then verify the merged SHA with
   `/api/health/release` and `release:smoke`.

## 下一位 AI 工作指引

1. Keep this PR scoped to the changed files listed above.
2. Do not include unrelated dirty changes from the original checkout.
3. Use direct GitHub status, `/api/health/release`, and `release:smoke` for
   final production proof.

## 相關 Commit

- Base commit: `3877a9e0ddbca67ad8aaa10c4063ade6c61b6992`.
- Current implementation commit before final commit: not committed yet.
