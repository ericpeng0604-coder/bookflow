# BookFlow AI Handoff

## 任務目標

Show messages as a standalone Header icon.

## 目前狀態與背景

- Branch: `codex/message-header-icon-deploy`.
- Base commit: `cee412fe01a58e15415d047f4df38e6def8b4e7d` (`origin/main`).
- Scope is runtime/UI plus release metadata; no database migration.
- Protected rollback/recovery files and the original dirty checkout are out of scope.

## 已完成

- Added a standalone `MessageCircle` Header button before the notification bell.
- Kept the existing conversation state, route, unread count, and `trade_message` navigation.
- Removed only the visible chats tab from the dashboard.
- Kept the Header icon visible on desktop and mobile, outside the mobile menu.
- Normalized the handoff contract section titles so release validation accepts UTF-8 handoff files.

## 下一步

1. Run focused checks, typecheck, lint, project checks, production build, and browser verification.
2. Commit and push the clean release worktree.
3. Open the PR, wait for required checks, merge it, and verify the production commit and release smoke checks.

## 變更檔案

- `components/marketplace-app.tsx`
- `app/globals.css`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-message-header-icon-release.md`

## 驗證結果

- TypeScript `tsc --noEmit`: passed.
- ESLint: passed.
- Project checks: passed (29/29).
- Chat checks: passed.
- Production build: passed.
- Browser verification: passed at 1280, 320, 375, and 390px; message button is icon-only, visible, and does not overflow.
- Legacy `?view=dashboard&tab=chats` URL loaded without a framework error overlay.

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
- Fix commit: `451767fddaa9494c82b2de2e3359a7abd90382e9`.
