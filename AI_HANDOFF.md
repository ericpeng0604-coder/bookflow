# BookFlow AI Handoff

## Current release

- Task ID: `20260726-marketplace-conversation-recovery`.
- Task: Centralize conversation read recovery behind the navigation seam.
- Branch: `agent/marketplace-architecture-20260726`.
- Base commit: `0a65850fb04cb9afae751e8e6f8a616096eb3e6f`.
- Current commit: `e6d1e734ed58651e1c34523e42454355e1892ba1`.
- No database migration is included; staging migration is NOT APPLICABLE.
- No GitHub workflow or protected recovery file is changed.

## Root cause

`TradeChatPanel` called `markConversationRead` directly, bypassing the
conversation navigation recovery path. A failed mark-read could therefore
leave navigation state stale instead of refreshing chats.

## Changes

- Added a pure conversation navigation policy for local read state, recovery,
  restoration, and removal.
- Routed app-level mark-read through the policy and refresh-on-failure seam.
- Removed direct data-layer mark-read calls from `TradeChatPanel`.
- Added focused behavior checks for reset, restore, hide, and recovery paths.

## Evidence

- Conversation navigation behavior: 4/4.
- Trade chat checks: 9/9.
- Chat switching checks: 5/5.
- Changed-file ESLint, TypeScript, and production build passed.
- Release plan: clean at current commit.
- PR #140 is draft; merge, deployment, release health, and production smoke
  remain NOT VERIFIED.

## Next steps

1. Pass PR #140 required checks and review.
2. Merge and record the exact full main SHA.
3. Run the protected production release workflow with that SHA.
4. Verify `/api/health/release` and production smoke for the same SHA.

## Files

- `components/marketplace-app.tsx`
- `components/marketplace/conversation-navigation-policy.ts`
- `scripts/check-conversation-navigation-behavior.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260726-marketplace-conversation-recovery.md`
- `AI_WORK_MANUAL.md`

## Safety

- Unrelated edits in the original dirty checkout were excluded.
- Protected recovery files remain unchanged.
- Do not claim production deployment until the merged full SHA, release
  health, and production smoke are verified.
