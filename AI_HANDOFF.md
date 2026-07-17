# BookFlow AI Handoff

## 任務目標

只部署第二階段專業化訊息功能，基於最新 `origin/main` `0f4643fc4aff8da1e3490b00651242826b1a3849`。

## 目前狀態與背景

- Branch: `codex/message-phase2-production-clean`.
- The branch includes the already-merged mainline mobile chat report-menu fix as its current base.
- The original dirty checkout remains isolated.
- Three migrations are included: two staging-history compatibility migrations and the message summary RPC migration.

## 已完成

- Added standalone `view=chat` message route with desktop full-height and mobile viewport handling.
- Added conversation preview, sender, activity time, unread count, pagination, realtime sorting, and unread updates.
- Added date separators, grouped messages, hidden actions, retry states, upload progress, removable image previews, mobile transaction-context collapse, focus restoration, Escape handling, and `aria-live`.
- Replaced visible 聊聊／聊天／聊天室 labels with 訊息.
- Restored the two migrations already present in staging but absent from the previous clean base: `20260717003854_student_card_ai_quota.sql` and `20260717004057_harden_active_user_rpc.sql`.
- Added `20260717100000_chat_message_summary.sql`.

## 下一步

1. Confirm the merge conflict resolution and rerun local release checks.
2. Re-run Staging Migration for the exact release SHA if the merge changes the migration SHA.
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
- `supabase/migrations/20260717003854_student_card_ai_quota.sql`
- `supabase/migrations/20260717004057_harden_active_user_rpc.sql`
- `supabase/migrations/20260717100000_chat_message_summary.sql`
- `scripts/check-chat-professional-ux.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260717-message-phase2-release.md`
- `.ai/history/20260717-message-phase2-migration-drift-fix.md`

## 驗證結果

- TypeScript: passed before the base synchronization.
- Targeted ESLint: passed before the base synchronization.
- `node scripts/check-chat-professional-ux.mjs`: passed 13/13 before the base synchronization.
- Production build: passed before the base synchronization.
- Staging Migration run `29566925528`: passed, including migration history and RPC/RLS verification.
- Production Migration run `29567007842`: passed for SHA `213b7513dd6c1a74f3ed7d7487236ab720dac917`.
- The PR currently needs merge-conflict resolution after `origin/main` advanced with the mobile chat report-menu fix.

## 風險與注意事項

- If the merge changes the release SHA, rerun production migration only after a new successful staging run for that exact SHA.
- Do not add unrelated runtime code for the compatibility migrations.
- Verify `/api/health/release` against the merged SHA; do not infer production state from a preview.
- Do not modify protected rollback files.

## 下一位 AI 工作指引

1. Resolve only the three merge conflicts: state metadata, handoff metadata, and the mobile back-button label.
2. Preserve the already-merged mainline mobile chat report-menu changes.
3. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD`, TypeScript, message UX checks, build, and diff check.
4. If the final SHA differs from `213b7513...`, rerun staging and production migration gates before merge.

## 相關 Commit

- Previous release base: `b7441fb87b63c5a57c719ae41bfc9349cf846841`.
- Current main base: `0f4643fc4aff8da1e3490b00651242826b1a3849`.
- Feature commit: `369a472b21a491f72f6db70ddf95d60c0d931cf8`.
- Migration-history fix commit: `213b7513dd6c1a74f3ed7d7487236ab720dac917`.
