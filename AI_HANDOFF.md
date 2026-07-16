# BookFlow AI Handoff

## 任務目標

Add the existing messages entry to the mobile hamburger menu.

## 目前狀態與背景

- Branch: `codex/message-menu-deploy`.
- Base commit: `ae41267c50328b330018e9522f2e8b650adeb99d` (`origin/main`).
- Scope is runtime/UI plus release metadata; no database migration.
- Protected rollback/recovery files and the original dirty checkout are out of scope.

## 已完成

- Added a `訊息` item with the existing `MessageCircle` icon to the mobile menu.
- Reused `openMessages()` and the existing `unreadMessages` state; no new data request or route was added.
- Kept the existing Header icon, chat route, legacy URL support, dashboard tab type, and `trade_message` navigation unchanged.
- Added only the small mobile unread badge styling needed by the new menu item.

## 下一步

1. Open the PR, wait for required checks, and merge it.
2. Verify the production commit and release smoke checks.

## 變更檔案

- `components/marketplace-app.tsx`
- `app/globals.css`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-message-menu-release.md`

## 驗證結果

- TypeScript `tsc --noEmit`: passed.
- ESLint: passed.
- Project checks: passed (29/29).
- Chat checks: passed.
- Production build: passed.
- Browser verification: passed at 320, 375, and 390px; menu `訊息` button was visible, retained its icon, and did not overflow.
- Legacy `?view=dashboard&tab=chats` support remains covered by the existing route implementation.

## 風險與注意事項

- No database or RPC changes.
- Authenticated live unread-count interaction was not exercised because no signed-in browser session was available.
- Verify the merged SHA through `/api/health/release`; do not infer production state from the preview deployment.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Preserve unrelated changes in the original checkout.
3. Do not modify protected recovery files.
4. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.

## 相關 Commit

- Base commit: `cee412fe01a58e15415d047f4df38e6def8b4e7d`.
- Feature commit: `571fe1561e21a9d27a48ed777c34316b2ddf33ad`.
