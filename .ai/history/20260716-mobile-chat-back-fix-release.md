# 2026-07-16 mobile chat back fix release

## Summary

Fixed the mobile chat back action reopening the same conversation and hardened
the desktop chat header against width overflow.

## Root cause

The back control cleared the selected conversation, but the last-chat restore
effect immediately read the persisted conversation ID and reopened it.

## Changes

- Added `closeConversation` to clear the persisted restore key before clearing
  the selected conversation.
- Added shrink/truncation constraints to the chat header flex layout.
- Updated both chat static checks to assert the new behavior contract.
- Recorded the stale-check lesson in `AI_WORK_MANUAL.md`.

## Verification

- `pnpm run typecheck`: passed
- `pnpm run lint`: passed
- `pnpm run check:project`: passed (29/29)
- `pnpm run check:chat-listing-order-ux`: passed (23/23)
- `node scripts/check-chat-visibility-and-feedback.mjs`: passed (9/9)
- `pnpm run build`: passed (22/22 static pages)

Production deployment and authenticated browser chat verification are pending
the PR merge and post-deploy smoke.
