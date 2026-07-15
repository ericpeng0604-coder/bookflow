# BookFlow AI Handoff

## 任務目標

Deploy optional student-card OCR verification and verified-seller marketplace priority.

## 目前狀態與背景

- Branch: `codex/student-verification-deploy`.
- Base commit: `5289f6634542742111cd7bbb7f3fad482e5a276d` (`origin/main`).
- This release adds the `我的交易 → 學生身分驗證` tab, OCR-only student ID
  parsing, moderator review, derived-field storage, and verified-seller
  marketplace ordering for books and secondhand listings.
- Database migration `20260714164420_student_verification_priority.sql` is
  required and must pass staging before production database approval.
- No protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- OCR accepts only current five-year student IDs and never exposes a manual ID
  input.
- Server-side RPCs revalidate the OCR candidate and return only
  `seller_verified` publicly.
- Verified sellers are ordered first with a cursor containing verification,
  creation time, and ID.
- Local typecheck, lint, student verification checks, and production build pass.

## 驗證結果

- Diff check: passed.
- Production build: passed.
- Vercel Preview: pending on the release PR.
- Staging migration/RLS probes: pending staging credentials.
- Production deployment: pending PR merge and post-merge verification.

## 下一步

1. Wait for the release PR checks and resolve only release-gate failures.
2. Merge the clean PR after required checks pass.
3. Apply the migration through the protected production workflow after staging
   approval.
4. Verify the Vercel production deployment commit and student verification flow.
5. Run production smoke checks for release health.

## 風險與注意事項

- A Vercel Preview is not production proof.
- Do not include unrelated local files or pnpm-generated files in the release.
- Approved verification rows retain only derived fields; image/OCR data must be
  cleared by the review/cleanup flow.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry in sync with the release commit.
2. Verify GitHub checks before merging; do not treat Preview as production.
3. Preserve all protected recovery files.

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `lib/marketplace/student-id.ts`
- `supabase/migrations/20260714164420_student_verification_priority.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260715-student-verification-release.md`

## 相關 Commit

- Base commit: `5289f6634542742111cd7bbb7f3fad482e5a276d`.
- Feature commit: `ac379e0987a20f187d91fe0eb43f1fa6c00076ae`.
