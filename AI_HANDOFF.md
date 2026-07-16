# BookFlow AI Handoff

## 任務目標

修復 marketplace 商品詳情頁交易確認卡在「確認中...」的問題，並讓同類型非同步表單在逾時、失敗或 callback 例外時都能離開 loading、顯示可理解的錯誤並安全重試。

## 目前狀態與背景

- Branch: `codex/confirmation-loading-recovery-followup`.
- Base commit: `ae7174f6a3f235fcd425c1ebf1f778efe20a549c` (`origin/main`).
- The original checkout remains dirty and mixed; this release worktree is isolated from it.
- No database migration, workflow, rollback file, or `.github/CODEOWNERS` change is included.
- Production deployment is pending PR #105 merge and the required post-merge release proof.

## 已完成

- Added an independent 10-second timeout around the active purchase-request lookup.
- Added an 8-second UI recovery timeout so a pending data-client thenable cannot keep the action disabled forever.
- Changed the lookup effect to use stable primitive dependencies and a per-book request key.
- Changed retry triggering to a separate nonce so setting the request key cannot cleanup the timer that it just created.
- Changed the request lookup error state from a disabled dead end to an enabled `重試確認` action.
- Added duplicate-submit protection and guaranteed busy-state cleanup for purchase requests.
- Added `try/catch/finally` recovery to authentication, administrator OTP, profile, account deletion, and password reset callbacks.
- Added a focused transaction-loading regression check and recorded the reusable prevention rule.

## 下一步

1. Wait for the refreshed PR checks and merge PR #105 after all required gates pass.
2. Run the repository's post-merge production deployment flow.
3. Verify the deployed commit with `/api/health/release` and the release smoke check.

## 變更檔案

- `components/marketplace-app.tsx`
- `lib/marketplace/queries.ts`
- `scripts/check-transaction-loading.mjs`
- `AI_WORK_MANUAL.md`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-marketplace-confirmation-loading-recovery.md`

## 驗證結果

- Transaction loading checks: passed (9/9).
- TypeScript no-emit check: passed.
- ESLint: passed.
- Project checks: passed (29/29) on the latest `origin/main` base.
- Production build: passed.
- PR preview checks before the latest base refresh: passed; refreshed PR checks are pending.
- Production deployment and smoke proof: not verified yet.

## 風險與注意事項

- A slow Supabase request now fails closed after 8 seconds in the UI and 10 seconds in the query wrapper, then exposes retry; it does not infer that no active request exists.
- The timeout prevents a permanent UI lock but does not replace production network or database monitoring.
- A Vercel Preview is not production proof.
- Do not modify the rollback workflows or `.github/CODEOWNERS`.

## 下一位 AI 工作指引

1. Preserve the latest-base commit and keep the original dirty checkout isolated.
2. Treat any unavailable staging, PR, deployment, or smoke evidence as `NOT VERIFIED`.
3. After merge, verify the exact production commit before claiming the fix is online.
4. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry synchronized.

## 相關 Commit

- Base commit: `1b125f6245a183b224b56601bffa7e0420214378`.
- Current implementation commit: `3dd9749`.
- Pull request: #105.
