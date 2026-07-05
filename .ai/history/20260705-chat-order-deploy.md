# 20260705 chat order deploy

## Summary

Prepared the scoped release branch `codex/chat-order-deploy` from `origin/main`
for the July 5 chat/order fixes.

## Changes

- Restored existing buyer order state on book detail refresh with
  `fetchActiveRequestForBook(...)`.
- Updated the book detail CTA to show `已下訂：...` when an existing request is
  known.
- Preserved desktop page scroll while selecting conversations.
- Kept the mobile chat rail wide enough to show conversation/book context and
  removed the old click-capture collapse behavior so users can switch chats.
- Added seller-facing cancel-reservation copy.
- Added migration `20260705100000_seller_cancel_reserved_request.sql` to allow
  sellers to cancel `reserved` and `awaiting_confirmation` requests.
- Updated regression checks for the new chat/order behavior.

## Verification

- `node scripts/check-chat-listing-order-ux.mjs`: passed, 20/20.
- `node scripts/check-chat-visibility-and-feedback.mjs`: passed, 9/9.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/next/dist/bin/next build`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node scripts/check-workflows.mjs`: passed.
- `git diff --check`: passed.

## Notes

- Supabase CLI is not installed locally; staging and production migration proof
  must come from the repository GitHub migration workflows.
- The worktree uses an ignored local `node_modules` junction for verification
  only.
