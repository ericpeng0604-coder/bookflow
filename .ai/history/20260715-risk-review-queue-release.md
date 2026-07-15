# Risk review queue release

## 任務目標

Replace the full-user risk warning list with a manageable moderator queue and
remove the orange underline from the homepage market switch.

## 已完成

- Added a server-paginated high/medium pending-risk queue with full-roster
  search mode, filters, KPI counts, and shared review status.
- Added moderator-only list, summary, detail, and status-update RPCs.
- Deferred raw review/report evidence to the selected-user detail drawer.
- Added responsive risk detail UI and collapsed policy settings.
- Scoped the market-switch underline removal so ordinary navigation active
  indicators remain unchanged.

## 驗證結果

- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/check-risk-warning.mjs`: passed, 23/23.
- `node scripts/check-listing-navigation-ui.mjs`: passed.
- `node node_modules/next/dist/bin/next build`: passed, 22/22 pages.
- `git diff --check`: passed.
- Local Supabase lint: NOT VERIFIED because local PostgreSQL was unavailable.
- Staging probes: NOT VERIFIED because staging credentials were unavailable.

## 風險與注意事項

- Migration `20260715142057_risk_review_queue.sql` must be applied to staging
  and production through the protected release workflow.
- The old zero-argument risk-list RPC is replaced by a parameterized
  paginated RPC; probes must use the new exact signature.
- No protected recovery file or unrelated dirty-checkout file is included.
