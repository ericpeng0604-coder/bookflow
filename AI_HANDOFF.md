# BookFlow AI Handoff

## 任務目標

縮短管理員審核操作的等待感：管理員按下通過或拒絕後，先立即更新待審核佇列與狀態提示，完整 moderation、risk 與 marketplace 資料在背景同步。使用者端即時通知不在本次範圍。

## 目前狀態與背景

- Branch: `codex/admin-moderation-live-refresh`.
- Base commit: `69315cf94495cd598111027b5bd392cbff869c53` (`origin/main`).
- This release changes the admin moderation refresh behavior and adds the Realtime publication needed for admin invalidation events.
- No protected recovery file is changed.
- Production deployment is pending local gates, PR checks, staging migration, merge, production migration, and smoke.

## 已完成

- Admin moderation mutations no longer wait for the full moderation and marketplace reload before showing completion feedback.
- Student verification review removes the pending card optimistically, restores it on failure, and refreshes the moderator projections in the background.
- Admin pages refresh on `student_verifications` Realtime events, on focus/visibility changes, and with a ten-second visible-page fallback interval.
- Added a versioned migration to publish `student_verifications` changes to Supabase Realtime; payloads remain an invalidation signal and the existing moderator RPC projection remains the source of truth.
- Added focused admin moderation refresh assertions.

## 下一步

1. Run release preflight, push, and open the release PR.
2. Wait for required checks including Staging Migration, then merge after they pass.
3. Run Production Migration with the merged commit SHA and matching successful staging run ID.
4. Verify the Vercel production deployment and production smoke.

## 變更檔案

- `components/marketplace-app.tsx`
- `app/api/admin/student-verifications/review/route.ts`
- `lib/marketplace/student-verification.ts`
- `lib/types.ts`
- `scripts/check-admin-moderation-refresh.mjs`
- `supabase/migrations/20260716135138_student_verification_result_delivery.sql`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-admin-moderation-live-refresh.md`

## 驗證結果

- Admin moderation refresh check: passed (7/7).
- Admin workbench check: passed (8/8).
- Typecheck: passed.
- ESLint: passed.
- Project checks: passed (28/28).
- Workflow checks: passed.
- Production build: passed.
- Staging and production database operations: pending PR workflow evidence.

## 風險與注意事項

- The original checkout remains dirty and mixed; this release worktree is intentionally isolated from it.
- The admin UI uses Realtime as an invalidation signal and keeps a ten-second fallback; it does not expose raw student-verification rows to the browser.
- A Vercel Preview is not production proof.
- Do not modify the rollback workflows or `.github/CODEOWNERS`.

## 下一位 AI 工作指引

1. Preserve the exact release commit and production deployment proof.
2. Keep the original dirty checkout isolated from this release worktree.
3. Treat any unavailable staging, PR, deployment, or smoke evidence as `NOT VERIFIED`.
4. Do not change protected recovery files without explicit authorization.

## 相關 Commit

- Base commit: `69315cf94495cd598111027b5bd392cbff869c53`.
- Current implementation commit: pending.
