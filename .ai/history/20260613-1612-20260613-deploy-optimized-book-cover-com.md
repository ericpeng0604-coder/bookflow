# AI 交接歷史

- 任務：deploy optimized book cover compression
- 執行者：codex
- 狀態：完成
- 基準 Commit：`a2ae3bb6aa42a86bbd8a0857b56dc7eff2a13388`
- 封存時間：2026-06-13T16:12:45.320Z

---
# BookFlow AI Handoff

## 目前目標

Optimize marketplace capacity for limited free-tier infrastructure and deploy
the verified release.

## 重要背景與決策

- The first capacity target is 5,000 members, 10,000 historical listings,
  5,000 active listings, and 200 concurrent users.
- Catalog totals are approximate and cached instead of counted on every page.
- Only an open chat keeps a Realtime subscription; notifications use polling.
- Production load testing remains prohibited without separate authorization.

## 已完成

- Split authenticated workspace loading by dashboard tab.
- Removed the global public-profile fetch and notification Realtime channel.
- Added cached catalog counts, paginated conversations and chat history.
- Added browser image compression, immutable storage caching, and old-image cleanup.
- Batched archived-listing cleanup and upgraded the guarded load-test tool.
- Applied `supabase/capacity-optimization.sql` to production and verified its
  indexes and function permissions.
- Reduced new book-cover uploads to a 1,000px maximum width with a 400KB
  compression target. Existing covers and chat images are unchanged.

## 剩餘工作

1. Merge pull request #18 after required checks pass.
2. Confirm the Vercel production deployment is ready.
3. Verify the public production catalog and the new cover-upload behavior.
4. Run authenticated mixed-workload tests only with isolated test accounts.

## 修改範圍

- Marketplace client data loading, notification refresh, chat, and image handling.
- Cached marketplace count API and lifecycle cleanup route.
- Supabase capacity migration and capacity/load-test checks.
- Setup and capacity documentation.

## 驗證結果

- TypeScript passed.
- Next.js production build passed.
- Filter, lifecycle, trade, browser push, and capacity checks passed.
- Capacity structure checks passed 10/10.
- Mobile menu body scroll lock and catalog count refresh were verified locally.
- Production migration returned success; all three indexes and RPC permissions
  were verified in Supabase SQL Editor.
- TypeScript and the Next.js production build passed after the cover compression
  adjustment.

## 風險或阻礙

- The 200-user capacity target is not yet proven because no approved staging
  load test has run.
- ESLint retains three non-blocking warnings for existing raw image elements.
- Resend SMTP domain configuration still requires dashboard verification.
- The new upload limits require one post-deployment authenticated upload check;
  existing stored covers are intentionally not recompressed.

## 下一個 AI 的操作

1. Inspect PR #18 and its deployment checks.
2. Verify Vercel production points to the merged commit.
3. Test anonymous catalog browsing and one authenticated cover upload.
4. Record mixed-workload capacity evidence before making full-platform claims.

## 最後基準 Commit

`a2ae3bb6aa42a86bbd8a0857b56dc7eff2a13388`
