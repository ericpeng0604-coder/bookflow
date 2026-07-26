# BookFlow AI Handoff

## 任務目標

新增賣家賣場與同賣家多商品合併購買意願，讓買家可一次選取多件商品，並讓賣家整批接受或拒絕。

## 目前狀態與背景

- Task ID: `20260726-seller-storefront-bundle`.
- Task: `seller storefront and multi-listing purchase-intent bundle`.
- Branch: `codex/seller-storefront-bundle-release-fix`.
- Base commit: `7808f7a6a0d7e0e88807e7b7086db660c73d03f8`.
- History: `.ai/history/20260726-seller-storefront-bundle.md`.
- Current commit: `0c39b1290eb665f6f09578092ce2cc87a3ac6ec2`.
- Production deployment is pending staging migration evidence and PR gates.
- No protected recovery files or GitHub workflows were changed.

## 已完成

- Added stable seller storefront navigation and seller public listings.
- Added multi-select bundle drafts, unavailable-item removal, Google-login submission, and bundle dashboard actions.
- Added bundle tables, RLS, RPCs, notifications, expiry processing, and cron integration.
- Restored source files from the clean production base after encoding damage and reapplied only the scoped feature.
- Declared `eslint-plugin-react-hooks` in package manifest and lockfile.

## 下一步

1. Run staging migration with the configured staging Supabase secrets.
2. Open and pass the PR checks for the current commit.
3. Obtain production migration approval, deploy, then verify `/api/health/release` and release smoke.

## 變更檔案

- `components/marketplace-app.tsx`
- `components/marketplace/navigation-state.ts`
- `components/marketplace/seller-storefront.tsx`
- `components/marketplace/bundle-request-panel.tsx`
- `lib/types.ts`
- `lib/marketplace/mappers.ts`
- `app/globals.css`
- `app/api/cron/listing-lifecycle/route.ts`
- `supabase/migrations/20260723183019_seller_storefront_bundle_requests.sql`
- `package.json` and `package-lock.json`
- `.ai/state.json`, `AI_HANDOFF.md`, and `.ai/history/20260726-seller-storefront-bundle.md`

## 驗證結果

- `node scripts/check-memory.mjs`: passed.
- `node scripts/run-project-checks.mjs`: passed 38/38.
- TypeScript, ESLint, and Next production build: passed in the validated release worktree.
- Staging migration: NOT VERIFIED; staging Supabase variables are not available.
- Production smoke: NOT VERIFIED; external GitHub and production network access failed in this environment.

## 風險與注意事項

- The database migration has not been applied to production.
- The latest GitHub main ref could not be refreshed because GitHub network access failed; base alignment is verified only against the locally fetched `7808f7a` source.
- Do not deploy the web feature before staging migration and production migration approval.

## 下一位 AI 工作指引

1. Keep the original dirty checkout untouched.
2. Configure staging secrets outside the repository and run the staging migration gate.
3. Keep the web deployment and production database migration as separate approvals.
4. Keep this handoff, `.ai/state.json`, and the matching history entry synchronized.

## 相關 Commit

- Base: `7808f7a6a0d7e0e88807e7b7086db660c73d03f8`.
- Current: `0c39b1290eb665f6f09578092ce2cc87a3ac6ec2`.
