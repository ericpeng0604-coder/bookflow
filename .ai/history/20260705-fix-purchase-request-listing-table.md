# AI Handoff Archive

- Task: fix purchase request listing table
- Actor: codex
- Status: ready for release
- Base commit: `f70ce8b2deed5d37df66614d07f722480329a48f`
- Archived at: 2026-07-05T14:32:29.443Z

---

# BookFlow AI Handoff

## 任務目標

Fix purchase-request submission so the buyer order modal no longer fails with
`relation "public.marketplace_listings" does not exist`.

## 目前狀態與背景

- Branch: `codex/fix-purchase-request-table`.
- Base commit: `f70ce8b2deed5d37df66614d07f722480329a48f` (`origin/main`).
- This release is scoped to the purchase-request database function and its
  regression guard.
- The release includes a database migration repair for
  `supabase/migrations/20260704160000_purchase_request_handoff_preferences.sql`.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Changed `create_purchase_request` to check `public.books` instead of the
  nonexistent `public.marketplace_listings`.
- Preserved the listing availability guard by requiring available, active,
  approved, visible listings from sellers other than the requester.
- Added a chat/order UX structure check so this migration must reference
  `public.books` and must not reference `marketplace_listings`.
- Recorded the reusable migration-schema lesson in `AI_WORK_MANUAL.md`.

## 下一步

1. Commit the scoped branch.
2. Run `node scripts/release-preflight.mjs`.
3. Push and open a PR.
4. Wait for PR checks, staging migration, and Vercel Preview.
5. After merge, run the protected Production Migration workflow.
6. Verify production with `/api/health/release` and `release:smoke`.

## 變更檔案

- `supabase/migrations/20260704160000_purchase_request_handoff_preferences.sql`
- `scripts/check-chat-listing-order-ux.mjs`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260705-fix-purchase-request-listing-table.md`

## 驗證結果

- `node scripts/check-chat-listing-order-ux.mjs`: passed, 22/22.
- `node scripts/release-plan.mjs`: passed.
- `node scripts/ai-collaboration.mjs check-ci origin/main HEAD`: passed for
  local handoff validation before commit.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node node_modules/next/dist/bin/next build`: passed.

## 風險與注意事項

- This fixes a production-affecting database function, so staging and
  production migration workflows are required.
- The original active checkout has unrelated dirty work. Keep this release in
  the clean worktree and do not include those changes.
- Protected recovery files are not in scope.

## 下一位 AI 工作指引

1. Keep the PR limited to the files listed above.
2. Do not include unrelated dirty changes from the original checkout.
3. Use the repository release workflow for PR checks, production migration, and
   production smoke proof.

## 相關 Commit

- Base commit: `f70ce8b2deed5d37df66614d07f722480329a48f`.
- Current implementation commit before final commit: not committed yet.
