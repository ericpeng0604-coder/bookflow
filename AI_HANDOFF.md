# BookFlow AI Handoff

## Scope

Deploy only the second-phase professional message experience from `origin/main` `b7441fb87b63c5a57c719ae41bfc9349cf846841`.

## Included

- Standalone `view=chat` message route with desktop full-height workspace and mobile viewport handling.
- Conversation summaries with last-message preview, sender, activity time, unread count, and pagination.
- Realtime conversation ordering and unread updates with stale-response protection.
- Date separators, grouped messages, hidden message actions, retry states, upload progress, and removable image previews.
- Collapsible transaction context on mobile, focus restoration, Escape handling, `aria-live`, and visible-label migration from 聊聊／聊天／聊天室 to 訊息.
- RPC migration `supabase/migrations/20260717100000_chat_message_summary.sql`.

## Verification

- TypeScript: passed.
- Targeted ESLint: passed with no errors.
- `node scripts/check-chat-professional-ux.mjs`: passed 13/13.
- Production build: passed.
- `git diff --check`: passed.
- Full `node scripts/run-project-checks.mjs`: baseline failure in `check-listing-navigation-ui.mjs`, which expects NativeDialog support absent from `origin/main`; no unrelated listing/modal changes were added.

## Release gates

1. Open the PR from `codex/message-phase2-production-clean`.
2. Wait for Vercel and Staging Migration checks.
3. Apply the new RPC migration to staging and verify the authenticated message flow.
4. Obtain explicit production migration approval, then merge.
5. Verify `https://bookflow-green.vercel.app/api/health/release` against the merged SHA and run release smoke.

## Safety

- Original dirty checkout is preserved and not used for release.
- Protected rollback files are unchanged.
- No unrelated OCR, student-verification, monitoring, workflow, or homepage changes are included.
