# BookFlow AI Handoff

## 任務目標

Ship the July 5 marketplace chat and order fixes:

- desktop chat selection must not move the outer page to the bottom;
- mobile chat must keep the left conversation rail usable for switching and show the related book;
- sellers must be able to cancel a reserved handoff;
- book detail refreshes must keep showing the buyer's existing order state instead of offering a new order.

## 目前狀態與背景

- Branch: `codex/chat-order-deploy`.
- Base commit: `2031902ff8d71ea8dd2a6d211a159288c2d63cdb` (`origin/main`).
- This release changes marketplace chat/order UI behavior and adds one Supabase migration that replaces the existing `cancel_purchase_request(uuid, text)` RPC.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added `fetchActiveRequestForBook(...)` and used it on book detail pages so existing pending, reserved, awaiting-confirmation, or completed buyer requests are restored after refresh.
- Changed the book detail CTA to show `已下訂：...` whenever the active/completed request is known.
- Preserved desktop scroll position while switching conversations from the left chat list.
- Removed the mobile chat rail click-capture collapse behavior and widened the open-state rail so the buyer/seller and book title remain visible and switchable.
- Updated seller cancellation copy for reserved handoffs.
- Added migration `supabase/migrations/20260705100000_seller_cancel_reserved_request.sql` so sellers can cancel requests in `reserved` or `awaiting_confirmation`, while buyers retain the existing cancellable statuses.
- Updated chat/order regression checks and the older chat visibility check to assert the new mobile rail behavior.

## 變更檔案

- `components/marketplace-app.tsx`
- `app/globals.css`
- `lib/marketplace/queries.ts`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/check-chat-visibility-and-feedback.mjs`
- `supabase/migrations/20260705100000_seller_cancel_reserved_request.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260705-chat-order-deploy.md`

## 驗證結果

- `node scripts/check-chat-listing-order-ux.mjs`: passed, 20/20.
- `node scripts/check-chat-visibility-and-feedback.mjs`: passed, 9/9.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/next/dist/bin/next build`: passed; production pages generated successfully.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node scripts/check-workflows.mjs`: passed.
- `git diff --check`: passed.

## 風險與注意事項

- This release includes a database migration. Staging Migration must pass before production approval, and production behavior is not fully online until the protected Production Migration workflow applies it.
- Supabase CLI is not installed in the local shell, so local `supabase --version` / CLI advisors were not run. Use the repository GitHub migration gates for staging and production proof.
- The clean worktree uses a local ignored `node_modules` junction to the existing checkout for verification only. It must not be committed.

## 下一步

1. Commit this scoped branch.
2. Run `node scripts/release-preflight.mjs`.
3. Push and open the PR.
4. Wait for PR checks, Staging Migration, and Vercel Preview.
5. Apply the protected Production Migration after approval.
6. Merge, wait for production deployment, then verify the merged SHA with `release:smoke`.

## 下一位 AI 工作指引

1. Keep the PR scoped to the six product/check/migration files plus handoff files listed above.
2. Do not include unrelated dirty changes from the original checkout.
3. Use direct GitHub workflow status, `/api/health/release`, and `release:smoke` for final production proof.

## 相關 Commit

- Base commit: `2031902ff8d71ea8dd2a6d211a159288c2d63cdb`.
