# 20260705 mobile chat page scroll deploy

## Summary

Prepared the scoped release branch `codex/mobile-chat-page-scroll` from
`origin/main` to fix the mobile chat behavior where tapping a conversation in
the left rail could move the entire page to the bottom.

## Changes

- Added page-scroll restoration for conversation-list selections on all
  viewport widths.
- Replaced chat bottom-sentinel `scrollIntoView` usage with
  `scrollChatLogToBottom(...)`, which scrolls only the chat message container.
- Updated the chat listing/order UX regression check to assert local chat-log
  scrolling and page-scroll preservation.
- Added `AI_WORK_MANUAL.md` lessons for mobile chat viewport preservation and
  clean release worktree package-manager checks.
- Added a global memory update note for the token waste discovered during this
  deployment attempt.

## Verification

- `node scripts/check-chat-listing-order-ux.mjs`: passed, 21/21.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node node_modules/next/dist/bin/next build`: passed.
- Protected recovery files were checked and are unchanged.

## Notes

- No database migration is included.
- No protected recovery files are changed.
- The Codex shell had `node` but not `npm`; this npm-lock worktree used a
  read-only local `node_modules` junction for verification only.
- The initial pnpm-based parallel verification attempt caused package-manager
  noise and dependency mismatch; this is documented in the work manual and
  global memory so future release work verifies the package manager first.
