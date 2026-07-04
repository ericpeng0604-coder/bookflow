# BookFlow AI Handoff

## 任務目標

Ship the marketplace order-coordination and chat-input UX update so buyers can
submit meetup preferences during checkout, revise them from chat before seller
handoff, and use a more stable mobile-friendly chat composer.

## 目前狀態與背景

- Branch: `codex/marketplace-ui-flow-release`.
- Base commit: `e469b50fca7f9ff0cfb206f862e9ca2ada5020ae`.
- This release changes user-facing marketplace UI behavior and adds one
  database migration for purchase-request meetup preferences.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added `preferredMeetupLocation` and `preferredMeetupTime` to purchase request
  client types and Supabase row mapping.
- Updated the request modal so buyers can:
  - fill preferred meetup location/time before confirming;
  - jump straight into chat with `先去聊聊確認`;
  - understand that meetup details can still be revised before seller handoff.
- Updated request submission logic to dedupe on message plus meetup preference
  fields and pass the new values through the RPC.
- Added `RequestCoordinationPanel` to request lists and the trade chat context.
- Added a buyer-only `修改面交資訊` action inside chat while the request is
  still pending, waitlisted, or reserved.
- Switched the chat composer from single-line input to auto-sizing textarea and
  gave quick phrases a dedicated horizontal scroller.
- Kept the chat log from force-scrolling while reviewing older messages and kept
  the unread-jump affordance intact.
- Made the course-name help affordance floating and restored filter-chevron
  tap-through behavior with explicit `select-filter` label treatment.
- Added migration
  `supabase/migrations/20260704160000_purchase_request_handoff_preferences.sql`
  to store meetup preference fields and expand `create_purchase_request(...)`.

## 變更檔案

- `components/marketplace-app.tsx`
- `app/globals.css`
- `lib/types.ts`
- `lib/marketplace/mappers.ts`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/check-listing-navigation-ui.mjs`
- `scripts/check-home-accessibility.mjs`
- `supabase/migrations/20260704160000_purchase_request_handoff_preferences.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260704-marketplace-order-coordination-release.md`

## 驗證結果

- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node scripts/check-chat-listing-order-ux.mjs`: passed, 16/16.
- `node scripts/check-listing-navigation-ui.mjs`: passed.
- `node scripts/check-home-accessibility.mjs`: passed, 26/26.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node node_modules/next/dist/bin/next build`: passed; production pages
  generated successfully.
- `node node_modules/eslint/bin/eslint.js .`: `NOT VERIFIED` in this worktree
  because the local install cannot resolve `eslint-plugin-react-hooks`.

## 風險與注意事項

- The migration is required before production behavior is fully online; a web
-only deploy is insufficient.
- Local `pnpm` verification in this clean worktree generated temporary
  `pnpm-lock.yaml` and `pnpm-workspace.yaml`; they were removed and must stay
  out of the commit.
- `node_modules` in this worktree is local verification state only and must not
  be committed.
- No production proof exists until the branch is merged, the production
  migration is approved/applied, and `release:smoke` confirms the merged SHA.

## 下一步

1. Review the final diff and keep the PR scoped to this marketplace UX and
   migration release.
2. Commit the feature files plus updated handoff files.
3. Run `node scripts/release-preflight.mjs`.
4. Push the branch and open a PR.
5. After required checks and staging migration pass, apply the production
   migration with explicit approval.
6. After merge and deployment, verify the merged SHA with
   `/api/health/release` and `release:smoke`.

## 下一位 AI 工作指引

1. Keep the PR scoped to this marketplace UX and migration release.
2. Keep `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/*.md` in sync.
3. Use direct status checks plus `/api/health/release` and `release:smoke` for
   post-merge production proof.

## 相關 Commit

- Base commit: `e469b50fca7f9ff0cfb206f862e9ca2ada5020ae`.
- Current implementation commit before final commit: `df60935918579c43112a1d55a3c215c1d2f70d4b`.
