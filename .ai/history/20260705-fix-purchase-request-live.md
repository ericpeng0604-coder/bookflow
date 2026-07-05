# AI Handoff Archive

- Task: fix purchase request live migration
- Actor: codex
- Status: ready for verification
- Base commit: `7d32e77c7407d15ffd7d3ad01034e777739192e5`
- Archived at: 2026-07-05T14:43:19.000Z

---

# BookFlow AI Handoff

## 任務目標

Repair the live purchase-request RPC so the buyer order modal no longer fails
with `relation "public.marketplace_listings" does not exist`.

## 目前狀態與背景

- Branch: `codex/fix-purchase-request-live`.
- Base commit: `7d32e77c7407d15ffd7d3ad01034e777739192e5` (`origin/main`).
- The previous release corrected an old migration file in git, but that file
  had already been applied in staging and production.
- This release is scoped to a new versioned migration that actually replaces
  the live `create_purchase_request` function.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added `supabase/migrations/20260705224319_fix_live_purchase_request_function.sql`
  to replace the live `create_purchase_request` RPC with the `public.books`
  availability check.
- Added a structure check that requires the live-fix migration to recreate
  `create_purchase_request` without referencing `marketplace_listings`.
- Recorded the release lesson that editing an already applied migration does
  not repair production.

## 下一步

1. Run the local checks for the scoped migration fix.
2. Commit and run `node scripts/release-preflight.mjs`.
3. Push and open a PR.
4. Wait for PR checks and staging migration.
5. Merge, run the protected Production Migration workflow, and verify live
   behavior again.

## 變更檔案

- `supabase/migrations/20260705224319_fix_live_purchase_request_function.sql`
- `scripts/check-chat-listing-order-ux.mjs`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260705-fix-purchase-request-live.md`

## 驗證結果

- `node scripts/release-plan.mjs`: passed.
- `node scripts/check-chat-listing-order-ux.mjs`: passed, 23/23.
- `node scripts/ai-collaboration.mjs check-ci origin/main HEAD`: passed for
  local handoff validation before commit.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node node_modules/next/dist/bin/next build`: passed.

## 風險與注意事項

- The failure is database-side, so a web deploy alone is not enough.
- Keep this PR limited to the new migration, the regression guard, and the
  required handoff files.
- Protected recovery files are not in scope.

## 下一位 AI 工作指引

1. Do not edit the old applied migration again for this fix.
2. Verify the new migration ran in both staging and production.
3. Confirm the live buyer order flow after production migration completes.

## 相關 Commit

- Base commit: `7d32e77c7407d15ffd7d3ad01034e777739192e5`.
- Current implementation commit before final commit: not committed yet.
