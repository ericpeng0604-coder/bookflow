# BookFlow AI Handoff

## 任務目標

只部署第二階段專業化訊息功能，基於 `origin/main` `b7441fb87b63c5a57c719ae41bfc9349cf846841`。

## 目前狀態與背景

- Branch: `codex/message-phase2-production-clean`.
- This release is isolated from the original dirty checkout.
- No GitHub workflow or protected recovery file is changed.
- A database migration is included for conversation summary RPCs.

## 已完成

- Added standalone `view=chat` message route with desktop full-height and mobile viewport handling.
- Added conversation preview, sender, activity time, unread count, pagination, realtime sorting, and unread updates.
- Added date separators, grouped messages, hidden actions, retry states, upload progress, removable image previews, mobile transaction-context collapse, focus restoration, Escape handling, and `aria-live`.
- Replaced visible 聊聊／聊天／聊天室 labels with 訊息.
- Added `20260717100000_chat_message_summary.sql`.

## 下一步

1. Resolve the staging migration-history mismatch without adding unrelated feature migrations.
2. Re-run Staging Migration for the exact release SHA.
3. Obtain explicit production migration approval, merge, and verify the merged SHA in production.
4. Run release smoke against `https://bookflow-green.vercel.app`.

## 變更檔案

- `components/marketplace-app.tsx`
- `components/marketplace/navigation-state.ts`
- `lib/marketplace/mappers.ts`
- `lib/marketplace/queries.ts`
- `lib/marketplace/trade-chat.ts`
- `lib/types.ts`
- `app/globals.css`
- `supabase/migrations/20260717100000_chat_message_summary.sql`
- `scripts/check-chat-professional-ux.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260717-message-phase2-release.md`

## 驗證結果

- TypeScript: passed.
- Targeted ESLint: passed with no errors.
- `node scripts/check-chat-professional-ux.mjs`: passed 13/13.
- Production build: passed.
- `git diff --check`: passed.
- Full `node scripts/run-project-checks.mjs`: baseline failure in `check-listing-navigation-ui.mjs`, which expects NativeDialog support absent from `origin/main`; no unrelated listing/modal changes were added.
- Staging Migration run `29565884248`: failed before applying this migration because remote history contains `20260717003854` and `20260717004057`, absent from the clean `origin/main` release base.

## 風險與注意事項

- The migration must pass Staging Migration before production approval.
- Do not add the unrelated student-card or active-user-RPC migrations just to mask the staging history mismatch.
- Do not repair staging migration history without explicit database-release authorization.
- Authenticated live message interaction still needs staging and production smoke verification.
- Do not infer production state from a preview deployment; verify `/api/health/release` against the merged SHA.
- Original dirty checkout, OCR, student-verification, monitoring, workflow, and homepage changes are out of scope.

## 下一位 AI 工作指引

1. Keep this handoff, `.ai/state.json`, and `.ai/history/20260717-message-phase2-release.md` synchronized.
2. Resolve the migration history mismatch within the explicitly approved release scope.
3. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
4. Do not modify protected rollback files.

## 相關 Commit

- Base commit: `b7441fb87b63c5a57c719ae41bfc9349cf846841`.
- Feature commit: `369a472b21a491f72f6db70ddf95d60c0d931cf8`.
